declare module 'mic' {
    import { Readable } from 'stream';

    export interface MicrophoneOptions {
        rate?: string;
        channels?: string;
        debug?: boolean;
        exitOnSilence?: number;
        device?: string;
    }

    export interface Microphone {
        getAudioStream(): Readable;
        start(): void;
        stop(): void;
        pause(): void;
        resume(): void;
    }

    function mic(options?: MicrophoneOptions): Microphone;
    export = mic;
}

