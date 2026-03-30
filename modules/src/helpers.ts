function parseJsonPayload(payload) {
    if (!payload) {
        return {};
    }

    if (typeof payload === "string") {
        try {
            return JSON.parse(payload);
        } catch (error) {
            return {};
        }
    }

    return payload;
}

function normalizeMode(mode): MatchMode {
    return mode === "timed" ? "timed" : "classic";
}

function getTurnLimitSeconds(mode: MatchMode): number | null {
    return mode === "timed" ? DEFAULT_TURN_SECONDS : null;
}

function createMatchLabel(mode: MatchMode): string {
    return JSON.stringify({
        name: MATCH_NAME,
        mode: normalizeMode(mode)
    });
}

function getMatchedMode(matches): MatchMode {
    if (!matches || !matches.length) {
        return "classic";
    }

    for (var i = 0; i < matches.length; i++) {
        var mode = readModeFromMatchmakerEntry(matches[i]);
        if (mode) {
            return mode;
        }
    }

    return "classic";
}

function readModeFromMatchmakerEntry(entry): MatchMode | null {
    if (!entry) {
        return null;
    }

    var candidates = [
        entry.properties,
        entry.stringProperties,
        entry.string_properties,
        entry.presence && entry.presence.properties,
        entry.presence && entry.presence.stringProperties,
        entry.presence && entry.presence.string_properties
    ];

    for (var i = 0; i < candidates.length; i++) {
        var current = candidates[i];
        if (!current) {
            continue;
        }

        return normalizeMode(current.mode);
    }

    return null;
}
