declare namespace nkruntime {
    interface Context {}
    interface Logger {
        info(message: string): void;
        warn(message: string): void;
        error(message: string): void;
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