
AutocivControls.StatsOverlay = class
{
    autociv_statsOverlay = Engine.GetGUIObjectByName("autociv_statsOverlay")
    preStats = {
        "     Player": state => state.name, // Player name
        " ■": state => "■", // Player color
        " #": state => `${state.index}`, // Player number
        " T": state => state.team != -1 ? `${state.team + 1}` : "", // Team number
    }
    stats = {
        " P": state => this.phases[state.phase] ?? 0,
        " Pop": state => state.popCount,
        " Inf": state => state.classCounts_Infantry,
        " Cav": state => state.classCounts_Cavalry,
        " Siege": state => state.classCounts_Seige,
        "   Food": state => Math.round(state.resourceCounts["food"]),
        "   Wood": state => Math.round(state.resourceCounts["wood"]),
        "  Stone": state => Math.round(state.resourceCounts["stone"]),
        "  Metal": state => Math.round(state.resourceCounts["metal"]),
        " Tec": state => state.researchedTechsCount,
        " Kil": state => state.enemyUnitsKilledTotal ?? 0,
    }
    widths = {} // Will be filled on the constructor
    phases = { "city": 3, "village": 1, "town": 2 }
    tickPeriod = 10
    textFont = "mono-stroke-10"
    configKey_visible = "autociv.session.statsOverlay.visible"
    hotkeyKey_visibleToggle = "autociv.session.statsOverlay.visible.toggle"

    constructor()
    {
        this.autociv_statsOverlay.hidden = Engine.ConfigDB_GetValue("user", this.configKey_visible) == "false"

        Object.keys(this.preStats).concat(Object.keys(this.stats)).forEach(value =>
        {
            this.widths[value] = value.length
        })

        Engine.SetGlobalHotkey(this.hotkeyKey_visibleToggle, "Press", this.toggle.bind(this));
        this.autociv_statsOverlay.onTick = this.onTick.bind(this)

        this.update()
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

    maxWithIndex(list)
    {
        let index = 0
        let value = -Infinity
        for (let i = 0; i < list.length; i++) if (list[i] > value)
        {
            value = list[i]
            index = i
        }
        return [value, index]
    }
    minWithIndex(list)
    {
        let index = 0
        let value = +Infinity
        for (let i = 0; i < list.length; i++) if (list[i] < value)
        {
            value = list[i]
            index = i
        }
        return [value, index]
    }

    playerColor(state)
    {
        return rgbToGuiColor(g_DiplomacyColors.displayedPlayerColors[state.index])
    }

    leftPadTrunc(text, size)
    {
        return text.substring(0, size).padStart(size)
    }

    update()
    {
        Engine.ProfileStart("AutocivControls.statsOverlay:update")
        const playerStates = Engine.GuiInterfaceCall("autociv_GetStatsOverlay").players?.filter((state, index, playerStates) =>
        {
            if (index == 0 && index != g_ViewedPlayer) // Gaia index 0
                return false

            state.index = index
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
        header = setStringTags(header, { "color": "210 210 210" })
        header += "\n"

        const values = {}
        for (let stat of Object.keys(this.stats))
        {
            let list = playerStates.map(this.stats[stat])
            values[stat] = {
                "list": list,
                "min": this.minWithIndex(list),
                "max": this.maxWithIndex(list),
            }
        }

        const entries = playerStates.map((state, index) =>
        {
            const preStats = Object.keys(this.preStats).
                map(row => this.leftPadTrunc(this.preStats[row](state), this.widths[row])).
                join("")

            const stats = Object.keys(values).map(stat =>
            {
                let text = this.leftPadTrunc(values[stat].list[index].toString(), this.widths[stat])
                switch (state.index)
                {
                    case values[stat].max[1]:
                        return setStringTags(text, { "color": "255 255 0 255" })
                    case values[stat].min[1]:
                        return setStringTags(text, { "color": "255 120 120 255" })
                    default:
                        return text
                }
            }).join("")

            if (state.state == "defeated")
                return setStringTags(preStats + stats, { "color": "255 255 255 128" })

            return setStringTags(preStats, { "color": this.playerColor(state) }) + stats

        }).join("\n")

        this.autociv_statsOverlay.caption = ""
        this.autociv_statsOverlay.size = `100%-450 100%-228-${(playerStates.length + 1) * 12 + 7} 100% 100%-228`
        this.autociv_statsOverlay.caption = setStringTags(header + entries, {
            "color": "250 250 250 250",
            "font": this.textFont
        })
    }
}