/**
 * Type declarations for dcmjs
 * Minimal types for our usage
 */

declare module 'dcmjs' {
  export namespace data {
    interface DicomDict {
      [tag: string]: {
        Value: any[];
        vr?: string;
      };
    }

    interface DicomMessage {
      dict: DicomDict;
    }

    class DicomMessage {
      static readFile(arrayBuffer: ArrayBuffer): DicomMessage;
    }

    class DicomMetaDictionary {
      static naturalizeDataset(dataset: DicomDict): any;
    }
  }
}
