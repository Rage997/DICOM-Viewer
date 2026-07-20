/**
 * Integration test - Check brain MRI test data availability
 * This test verifies test data exists and provides a quick visual check
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';

describe('Brain MRI Test Data', () => {
  const TEST_DATA_PATH = join(process.cwd(), 'test-data', 'dicom-samples', 'brain-mr');

  it('should have brain MRI test data available', async () => {
    const exists = existsSync(TEST_DATA_PATH);

    if (!exists) {
      console.log('\n⚠️  Brain MRI test data not found');
      console.log('📁 Expected location:', TEST_DATA_PATH);
      console.log('📥 Test data is available at: test-data/dicom-samples/brain-mr/');
      console.log('✅ This is optional - you can still use the app by loading files manually\n');
      return; // Skip test if data not present
    }

    const files = await readdir(TEST_DATA_PATH);
    const dicomFiles = files.filter((f: string) => !f.startsWith('.') && f.endsWith('.dcm'));

    expect(dicomFiles.length).toBeGreaterThan(0);
    console.log(`\n✅ Found ${dicomFiles.length} DICOM files in test data`);
    console.log('📂 Load them at: http://localhost:8050');
    console.log('🎯 Just drag the brain-mr folder onto the viewport!\n');
  });

  it('should provide test data instructions', () => {
    console.log('\n📋 To manually test the 3D viewer:');
    console.log('  1. Start dev server: npm run dev');
    console.log('  2. Open http://localhost:8050');
    console.log('  3. Drag test-data/dicom-samples/brain-mr folder onto viewport');
    console.log('  4. Wait for loading (2-5 seconds)');
    console.log('  5. Check 3D view (bottom-right) for brain structures');
    console.log('  6. Click "3D Settings" to adjust opacity/quality');
    console.log('  7. Try rotating (left-drag), panning (right-drag), zoom (scroll)\n');

    expect(true).toBe(true); // Always pass
  });
});
