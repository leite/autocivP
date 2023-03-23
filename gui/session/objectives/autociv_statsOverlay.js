
AutocivControls.StatsOverlay = class
{
    autociv_statsOverlay = Engine.GetGUIObjectByName("autociv_statsOverlay")
    preStats = {
        "Player      ": state => state.state == "defeated" ? `[icon="icon_defeated_autociv" displace="-2 3"]${state.name}` : state.state == "won" ? `[icon="icon_won_autociv" displace="-2 3"]${state.name}` : state.name, // Player name
        "■ ": state => "■", // Player color
        "# ": state => `${state.playerNumber}`, // Player number
        "T ": state => state.team != -1 ? `${state.team + 1}` : "", // Team number
    }
    stats = {
        "P": state => state.phase,
        " Pop": state => state.popCount,
        " Sup": state => state.classCounts_Support,
        " Inf": state => state.classCounts_Infantry,
        " Cav": state => state.classCounts_Cavalry,
        " Sig": state => state.classCounts_Siege,
        " Chp": state => state.classCounts_Champion,
        "   Food": state => Math.round(state.resourceCounts["food"]),
        "   Wood": state => Math.round(state.resourceCounts["wood"]),
        "  Stone": state => Math.round(state.resourceCounts["stone"]),
        "  Metal": state => Math.round(state.resourceCounts["metal"]),
        " Tec": state => state.researchedTechsCount,
        " Kil": state => state.enemyUnitsKilledTotal ?? 0,
    }
    widths = {} // Will be filled on the constructor
    tickPeriod = 10
    textFont = "mono-stroke-10"
    configKey_visible = "autociv.session.statsOverlay.visible"
    configKey_brightnessThreshold = "autociv.session.statsOverlay.brightnessThreshold"

    constructor()
    {
        this.autociv_statsOverlay.hidden = Engine.ConfigDB_GetValue("user", this.configKey_visible) == "false"
        this.autociv_brightnessThreshold = Engine.ConfigDB_GetValue("user", this.configKey_brightnessThreshold);

        for (let name in this.preStats)
            this.widths[name] = name.length

        for (let name in this.stats)
            this.widths[name] = name.length

        this.autociv_statsOverlay.onTick = this.onTick.bind(this)
        this.update()
        registerConfigChangeHandler(this.onConfigChanges.bind(this))
    }

    onConfigChanges(changes)
    {
        if (changes.has(this.configKey_visible))
            this.autociv_statsOverlay.hidden = Engine.ConfigDB_GetValue("user", this.configKey_visible) == "false"
        if (changes.has(this.configKey_brightnessThreshold))
            this.autociv_brightnessThreshold = Engine.ConfigDB_GetValue("user", this.configKey_brightnessThreshold)
    }

    toggle()
    {
        this.autociv_statsOverlay.hidden = !this.autociv_statsOverlay.hidden
        Engine.ConfigDB_CreateAndWriteValueToFile(
            "user",
            this.configKey_visible,
            this.autociv_statsOverlay.hidden ? "false" : "true",
            "config/user.cfg"
        )
    }

    onTick()
    {
        if (this.autociv_statsOverlay.hidden)
            return

        if (g_LastTickTime % this.tickPeriod == 0)
            this.update()
    }

    maxIndex(list)
    {
        let index = 0
        let value = list[index]
        for (let i = 1; i < list.length; i++) if (list[i] > value)
        {
            value = list[i]
            index = i
        }
        return index
    }

    minIndex(list)
    {
        let index = 0
        let value = list[index]
        for (let i = 1; i < list.length; i++) if (list[i] < value)
        {
            value = list[i]
            index = i
        }
        return index
    }

    playerColor(state)
    {
        return brightenedColor(rgbToGuiColor(g_DiplomacyColors.displayedPlayerColors[state.playerNumber]), this.autociv_brightnessThreshold)
    }

    leftPadTrunc(text, size)
    {
        return text.substring(0, size).padStart(size)
    }

    rightPadTruncPreStats(text, num)
    {
        let key = `${text} ${num}`
        if (!this.autociv_preStatsSeenBefore[key])
        {
            const Regexp = /(^\[.*?\])(.*)/
            let str = ""
            // Icons have a width of 18, a single letter has a width of 6
            // Engine.GetTextWidth(this.textFont, "A") = 6
            // Slice of 3 characters more when the text has an icon.
            if (num > 2 && Regexp.test(text))
                str = text.replace(Regexp, "$1") + splitRatingFromNick(text.replace(Regexp, "$2")).nick.slice(0, num - 4).padEnd(num - 3)
            else if (num > 2)
                str = splitRatingFromNick(text).nick.slice(0, num - 1).padEnd(num)
            else
                str = text.padEnd(num)
            this.autociv_preStatsSeenBefore[key] = str;
        }
        return this.autociv_preStatsSeenBefore[key]
    }

    calcWidth(rowLength)
    {
        return Engine.GetTextWidth(this.textFont, " ") * rowLength + this.autociv_statsOverlay.buffer_zone * 2
    }

    calcHeight(rowQuantity)
    {
        return Engine.GetTextWidth(this.textFont, " ") * 2 * rowQuantity + this.autociv_statsOverlay.buffer_zone
    }

    computeSize(rowQuantity, rowLength)
    {
        return `100%-${this.calcWidth(rowLength)} 100%-228-${this.calcHeight(rowQuantity)} 100% 100%-228`
    }

    update()
    {
        Engine.ProfileStart("AutocivControls.statsOverlay:update")
        const playerStates = Engine.GuiInterfaceCall("autociv_GetStatsOverlay").players?.filter((state, index, playerStates) =>
        {
            if (index == 0 && index != g_ViewedPlayer) // Gaia index 0
                return false

            state.playerNumber = index
            if (g_IsObserver || !g_Players[g_ViewedPlayer] || index == g_ViewedPlayer)
                return true
            if (!playerStates[g_ViewedPlayer].hasSharedLos || !g_Players[g_ViewedPlayer].isMutualAlly[index])
                return false
            return true
        })

        if (!playerStates)
            return

        let header = Object.keys(this.widths).
            map(row => this.leftPadTrunc(row, this.widths[row])).
            join("")
        const rowLength = header.length
        header = setStringTags(header, { "color": "210 210 210" })
        header += "\n"

        const values = {}
        for (let stat of Object.keys(this.stats))
        {
            let list = playerStates.map(this.stats[stat])
            values[stat] = {
                "list": list,
                "min": this.minIndex(list),
                "max": this.maxIndex(list),
            }
        }

        const entries = playerStates.map((state, index) =>
        {
            const preStats = Object.keys(this.preStats).
                map(row => this.rightPadTruncPreStats(this.preStats[row](state), this.widths[row])).
                join("")

            const stats = Object.keys(values).map(stat =>
            {
                let text = this.leftPadTrunc(values[stat].list[index].toString(), this.widths[stat])
                switch (index)
                {
                    case values[stat].max: return setStringTags(text, { "color": "230 230 0" })
                    case values[stat].min: return setStringTags(text, { "color": "255 100 100" })
                    default: return text
                }
            }).join("")

            if (state.state == "defeated")
                return setStringTags(preStats + stats, { "color": "255 255 255 128" })

            return setStringTags(preStats, { "color": this.playerColor(state) }) + stats

        }).join("\n")

        this.autociv_statsOverlay.caption = ""
        this.autociv_statsOverlay.size = this.computeSize(playerStates.length + 1, rowLength)
        this.autociv_statsOverlay.caption = setStringTags(header + entries, {
            "color": "250 250 250 250",
            "font": this.textFont
        })
        Engine.ProfileStop()
    }
}

// Use JS cache for preStats
AutocivControls.StatsOverlay.prototype.autociv_preStatsSeenBefore = {}
