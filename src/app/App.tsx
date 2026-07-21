import { useEffect, useState } from 'react';
import { backendDetector } from '@/utils/performance/RenderingBackend';
import { FileLoader } from '@/features/dicom/loader/FileLoader';
import { Toolbar } from '@/components/layout/Toolbar';
import { StatusBar } from '@/components/layout/StatusBar';
import { ViewportGrid } from '@/components/viewer/ViewportGrid';
import { CompareView } from '@/components/viewer/CompareView';
import { MeasurementsPanel } from '@/components/viewer/MeasurementsPanel';
import { ErrorDialog } from '@/components/common/ErrorDialog';
import { WarningDialog } from '@/components/common/WarningDialog';
import { InteractionHint } from '@/components/viewer/InteractionHint';
import { useDicomLoader } from '@/hooks/useDicomLoader';
import { useStudyPipeline } from '@/hooks/useStudyPipeline';
import { presetForDigit } from '@/features/viewer/presets';
import { isTextEntryTarget } from '@/utils/keyboard';
import { getFlag, setFlag } from '@/utils/storage';
import { exportViewportPng, exportCollagePng } from '@/utils/exportPng';
import { useStore, useLoading, useProgress } from '@/state/store';
import type { RenderingBackend, LayoutMode, ViewportOrientation, Measurement } from '@/types';

// localStorage flag: the first-run navigation hint has been shown/dismissed.
const HINT_SEEN_KEY = 'hint.navigate.seen';

// Demo dataset: a downsampled brain MRI served from public/. BASE_URL keeps the
// path correct under a subpath deploy (e.g. GitHub Pages project sites).
const DEMO_URL = `${import.meta.env.BASE_URL}demo/brain-mr.zip`;

function App() {
  const [backend, setBackend] = useState<RenderingBackend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowLevel, setWindowLevel] = useState(40); 
  const [windowWidth, setWindowWidth] = useState(80);
  const [showHint, setShowHint] = useState(false);
  const [layout, setLayout] = useState<LayoutMode>('quad');
  const [activeOrientation, setActiveOrientation] = useState<ViewportOrientation>('axial');
  const [showMeasurements, setShowMeasurements] = useState(false);

  const isLoading = useLoading();
  const progress = useProgress();
  const files = useStore((state) => state.files);
  const clearAll = useStore((state) => state.clearAll);
  const volumes = useStore((state) => state.volumes);
  const activeSeriesUID = useStore((state) => state.activeSeriesUID);
  const setActiveSeriesUID = useStore((state) => state.setActiveSeriesUID);
  const setFocusTarget = useStore((state) => state.setFocusTarget);

  const { activeVolume, isSingleSlice } = useStudyPipeline();

  const {
    loadFiles,
    loadFromUrl,
    openFilePicker,
    activeErrors,
    filesWithWarnings,
    handleSkipFile,
    handleSkipAllErrors,
    handleStopLoading,
    handleProceedWithWarnings,
    handleRejectWarnings,
  } = useDicomLoader();

  useEffect(() => {
    const detectBackend = async () => {
      try {
        const detected = await backendDetector.detectBestBackend();
        setBackend(detected);
        // Uncomment to log rendering capabilities:
        // await backendDetector.logCapabilities();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('Failed to detect rendering backend:', err);
      }
    };

    detectBackend();
  }, []);

  // Auto-load a dataset from the URL: `?url=<zip>` loads any hosted study;
  // `?demo` (or `?demo=true`) loads the bundled demo. Runs once on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    const demoParam = params.get('demo');
    if (urlParam) {
      void loadFromUrl(urlParam);
    } else if (demoParam !== null && demoParam !== 'false') {
      void loadFromUrl(DEMO_URL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcut: Ctrl+O
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        if (!isLoading) {
          openFilePicker();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, openFilePicker]);

  // Keyboard shortcut: digits 1..6 apply window/level presets (only with a study)
  useEffect(() => {
    if (!activeVolume) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextEntryTarget(e.target)) return;
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        useStore.getState().toggleInvert2d();
        return;
      }
      const preset = presetForDigit(e.key);
      if (!preset) return;
      e.preventDefault();
      setWindowLevel(preset.windowLevel);
      setWindowWidth(preset.windowWidth);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVolume]);

  const handleDrop = async (dataTransfer: DataTransfer) => {
    // Extract files from DataTransfer (handles folders)
    const files = await FileLoader.extractFilesFromDataTransfer(dataTransfer);
    if (files.length > 0) {
      await loadFiles(files);
    }
  };

  const handleOpenFiles = () => {
    openFilePicker();
  };

  const handleOpenFolder = () => {
    openFilePicker({ directory: true });
  };

  const handleLoadDemo = () => {
    void loadFromUrl(DEMO_URL);
  };

  const handleCloseStudy = () => {
    clearAll();
    setLayout('quad');
    setWindowLevel(40);
    setWindowWidth(80);
  };

  const handleWindowLevelChange = (level: number, width: number) => {
    setWindowLevel(level);
    setWindowWidth(width);
  };

  const handleLayoutChange = (next: LayoutMode) => {
    setLayout(next);
    // The 1+3 layout leads with the 3D render as its primary pane by default.
    if (next === 'one-plus-three') {
      setActiveOrientation('3d');
    }
  };

  const handleExportActive = () => {
    // Single-slice studies always render the axial pane regardless of layout.
    const orientation = isSingleSlice ? 'axial' : activeOrientation;
    void exportViewportPng({
      orientation,
      windowLevel: orientation === '3d' ? undefined : windowLevel,
      windowWidth: orientation === '3d' ? undefined : windowWidth,
    });
  };

  const handleExportCollage = (anonymize: boolean) => {
    // Patient/study fields come from the active series' first file; volume
    // supplies modality/dimensions/spacing.
    const { activeSeriesUID, files } = useStore.getState();
    const meta = files.find((f) => f.metadata.seriesInstanceUID === activeSeriesUID)?.metadata;
    void exportCollagePng({
      anonymize,
      study: {
        patientName: meta?.patientName,
        patientId: meta?.patientId,
        patientSex: meta?.patientSex,
        patientBirthDate: meta?.patientBirthDate,
        studyDate: meta?.studyDate,
        studyDescription: meta?.studyDescription,
        modality: activeVolume?.modality ?? meta?.modality,
        dimensions: activeVolume?.dimensions,
        spacing: activeVolume?.spacing,
        windowLevel,
        windowWidth,
      },
    });
  };

  const handleJumpTo = (m: Measurement) => {
    setActiveSeriesUID(m.seriesInstanceUID);
    setActiveOrientation(m.orientation);
    // Compare mode has no data-viewport panes to receive the jump — return to quad.
    if (layout === 'compare') setLayout('quad');
    setFocusTarget({
      seriesInstanceUID: m.seriesInstanceUID,
      orientation: m.orientation,
      sliceIndex: m.sliceIndex,
    });
  };


  // Update window/level from volume defaults when new volume loads
  useEffect(() => {
    if (activeVolume) {
      setWindowLevel(activeVolume.windowLevel ?? 40);
      setWindowWidth(activeVolume.windowWidth ?? 400);

      // Show the navigation hint once ever (dismissal persisted across reloads).
      if (!getFlag(HINT_SEEN_KEY)) {
        setShowHint(true);
      }
    }
  }, [activeVolume]);

  const handleDismissHint = () => {
    setShowHint(false);
    setFlag(HINT_SEEN_KEY, true);
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 p-8">
        <div className="max-w-md space-y-4 rounded-lg border border-red-900/50 bg-neutral-900 p-6">
          <h1 className="text-lg font-semibold text-red-500">
            Rendering Backend Error
          </h1>
          <p className="text-sm text-neutral-300">{error}</p>
          <p className="text-xs text-neutral-500">
            This application requires WebGL2 or WebGPU support.
            Please use a modern browser.
          </p>
        </div>
      </div>
    );
  }

  if (!backend) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          <span className="text-sm text-neutral-400">Initializing renderer...</span>
        </div>
      </div>
    );
  }

  const hasData = files.length > 0 && activeVolume !== null;

  return (
    <div className="flex h-screen flex-col bg-neutral-950">
      <Toolbar
        onOpenFiles={handleOpenFiles}
        onOpenFolder={handleOpenFolder}
        onCloseStudy={handleCloseStudy}
        onApplyPreset={handleWindowLevelChange}
        windowLevel={windowLevel}
        windowWidth={windowWidth}
        disabled={isLoading}
        hasStudy={hasData}
        backend={backend}
        layout={layout}
        onLayoutChange={handleLayoutChange}
        layoutDisabled={!hasData || isSingleSlice}
        compareDisabled={volumes.size < 2}
        onExportActive={handleExportActive}
        onExportCollage={handleExportCollage}
        measurementsListOpen={showMeasurements}
        onToggleMeasurementsList={() => setShowMeasurements((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden">
        {layout === 'compare' && hasData ? (
          <CompareView
            volumes={volumes}
            files={files}
            leftSeriesUID={activeSeriesUID!}
            onLeftSeriesChange={setActiveSeriesUID}
          />
        ) : (
          <ViewportGrid
            hasData={hasData}
            onDrop={handleDrop}
            onLoadDemo={handleLoadDemo}
            volume={activeVolume}
            windowLevel={windowLevel}
            windowWidth={windowWidth}
            singleSlice={isSingleSlice}
            layout={layout}
            activeOrientation={activeOrientation}
            onSelectOrientation={setActiveOrientation}
            onWindowLevelChange={handleWindowLevelChange}
          />
        )}
        </main>
        {hasData && showMeasurements && (
          <MeasurementsPanel
            onClose={() => setShowMeasurements(false)}
            onJumpTo={handleJumpTo}
          />
        )}
      </div>

      <StatusBar
        backend={backend}
        windowLevel={hasData ? windowLevel : undefined}
        windowWidth={hasData ? windowWidth : undefined}
        sliceCount={hasData ? activeVolume!.dimensions.z : undefined}
        status={isLoading ? 'loading' : 'ready'}
        progress={progress}
      />

      {activeErrors.length > 0 && (
        <ErrorDialog
          errors={activeErrors}
          onSkipFile={handleSkipFile}
          onSkipAll={handleSkipAllErrors}
          onStop={handleStopLoading}
        />
      )}

      {filesWithWarnings.length > 0 && (
        <WarningDialog
          files={filesWithWarnings.map((file) => ({
            fileName: file.fileName,
            warnings: file.warnings || [],
          }))}
          onProceed={handleProceedWithWarnings}
          onReject={handleRejectWarnings}
        />
      )}

      {/* Interaction Hint - Shows once on first load */}
      {showHint && <InteractionHint onDismiss={handleDismissHint} />}
    </div>
  );
}

export default App;
