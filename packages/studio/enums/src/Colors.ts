export const Colors = {
    blue: "hsl(189, 100%, 65%)",
    green: "hsl(150, 77%, 69%)",
    yellow: "hsl(60, 100%, 84%)",
    cream: "hsl(65, 20%, 83%)",
    orange: "hsl(31, 100%, 73%)",
    red: "hsl(354, 100%, 65%)",
    purple: "hsl(314, 100%, 78%)",
    bright: "hsl(197, 0%, 100%)",
    gray: "hsl(197, 31%, 85%)",
    dark: "hsl(197, 15%, 62%)",
    shadow: "hsl(197, 10%, 42%)",
    black: "hsl(197, 10%, 14%)",
    background: "hsl(197, 6%, 3%)",
    panelBackground: "hsl(197, 14%, 7%)",
    panelBackgroundBright: "hsl(197, 14%, 10%)",
    panelBackgroundDark: "hsl(197, 14%, 4%)"
}

export const initializeColors = (root: { style: { setProperty: (name: string, value: string) => void } }) => {
    Object.entries(Colors).forEach(([name, value]) => {
        const cssName = name.replace(/([A-Z])/g, "-$1").toLowerCase()
        console.debug(`--color-${cssName}`, value)
        root.style.setProperty(`--color-${cssName}`, value)
    })
}