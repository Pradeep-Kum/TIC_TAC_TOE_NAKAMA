declare global {
    namespace nkruntime {
        interface Context {}
        interface Logger {
            info(msg: string): void;
            warn(msg: string): void;
            error(msg: string): void;
        }
        interface Nakama {}
        interface Initializer {
            registerMatch(id: string, def: any): void;
        }

        interface MatchInit {}
        interface MatchJoinAttempt {}
        interface MatchJoin {}
        interface MatchLeave {}
        interface MatchLoop {}
        interface MatchTerminate {}
        interface MatchSignal {}
    }
}

export {};