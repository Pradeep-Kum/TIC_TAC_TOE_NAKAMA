declare namespace nkruntime {
    interface Context {
        userId?: string;
        user_id?: string;
    }

    interface Logger {
        info(message: string, ...args: any[]): void;
        warn(message: string, ...args: any[]): void;
        error(message: string, ...args: any[]): void;
    }

    interface Nakama {
        binaryToString(data: string | ArrayBuffer): string;
        stringToBinary(data: string): string;
        matchCreate(module: string, params: {[key: string]: any}): string;
    }

    interface Presence {
        userId?: string;
        user_id?: string;
        sessionId?: string;
        session_id?: string;
    }

    interface MatchDataMessage {
        opCode?: number;
        op_code?: number;
        data: string | ArrayBuffer;
        sender: Presence;
    }

    interface MatchDispatcher {
        broadcastMessage(opCode: number, data: string, presences?: Presence[] | null): void;
    }

    interface MatchmakerResult {}

    interface Initializer {
        registerMatch(id: string, def: any): void;
        registerRpc(id: string, fn: any): void;
        registerMatchmakerMatched(fn: any): void;
    }
}

type Nakama = nkruntime.Nakama;
type Presence = nkruntime.Presence;
type UserPresence = nkruntime.Presence;
type MatchDataMessage = nkruntime.MatchDataMessage;
type MatchDispatcher = nkruntime.MatchDispatcher;
