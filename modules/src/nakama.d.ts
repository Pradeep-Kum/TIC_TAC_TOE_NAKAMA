declare global {
    namespace nkruntime {
        interface Context {
            userId?: string;
            user_id?: string;
        }

        interface Logger {
            info(msg: string, ...args: any[]): void;
            warn(msg: string, ...args: any[]): void;
            error(msg: string, ...args: any[]): void;
        }

        interface Nakama {
            binaryToString(data: string | ArrayBuffer): string;
            stringToBinary(data: string): string;
            matchCreate(module: string, params: {[key: string]: any}): string;
            leaderboardCreate(id: string, authoritative: boolean, sortOrder: string, operator: string, resetSchedule?: string | null, metadata?: {[key: string]: any}, enableRanks?: boolean): void;
            leaderboardRecordsList(id: string, ownerIds: string[], limit: number, cursor?: string | null, expiry?: number): any;
            leaderboardRecordWrite(id: string, ownerId: string, username: string, score: number, subscore: number, metadata: {[key: string]: any}, operator: string): void;
            storageRead(objects: any[]): any[];
            storageWrite(objects: any[]): void;
        }

        interface Presence {
            userId?: string;
            user_id?: string;
            sessionId?: string;
            session_id?: string;
            username?: string;
            user_name?: string;
            properties?: {[key: string]: any};
            stringProperties?: {[key: string]: any};
            string_properties?: {[key: string]: any};
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

        interface Initializer {
            registerMatch(id: string, def: any): void;
            registerRpc(id: string, fn: any): void;
            registerMatchmakerMatched(fn: any): void;
        }
    }
}

export {};
