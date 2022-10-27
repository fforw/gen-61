import domready from "domready"
import "./style.css"
import { randomPaletteWithBlack } from "./randomPalette"
import Color, { getLuminance } from "./Color"


const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;
const DEG2RAD_FACTOR = TAU / 360;

const config = {
    width: 0,
    height: 0,
    palette: ["#000", "#fff"],
    bg: "#000",
    directions: [0, TAU/2]
};

function getColorExcluding(... exclusions)
{
    const { bg, palette } = config

    let color;
    do
    {
        color = palette[0|Math.random() * palette.length]
    } while(exclusions.indexOf(color) >= 0)

    return color;
}

/**
 * @type CanvasRenderingContext2D
 */
let ctx;
let canvas;

domready(
    () => {

        canvas = document.getElementById("screen");
        ctx = canvas.getContext("2d");

        const width = (window.innerWidth) | 0;
        const height = (window.innerHeight) | 0;

        config.width = width;
        config.height = height;

        canvas.width = width;
        canvas.height = height;

        const angle = Math.random() * TAU

        config.directions = [
            angle,
            angle + TAU/2,
            angle + TAU/8 + Math.floor(Math.random() * 4) * TAU/4
        ]

        const paint = () => {

            const palette = randomPaletteWithBlack()

            const bgColor = palette[0 | Math.random() * palette.length]
            config.palette = palette
            config.bg = bgColor
            ctx.fillStyle = bgColor

            const fgColor = getLuminance(Color.from(bgColor)) < 10000 ? "#fff" : "#000"

            ctx.fillRect(0, 0, width, height)


            const size = Math.min(width, height)

            const pow = 0.2 + Math.random()

            let area = (width * height) * (0.15 + 0.85 * Math.random() )

            while (area > 0)
            {
                const fillColor = getColorExcluding(bgColor, fgColor)

                const choice = 0 | Math.random() * 4

                let gradient = null
                const radius = Math.round(10 + Math.pow(Math.random(), pow) * size / 5)
                const x = 0 | Math.random() * width
                const y = 0 | Math.random() * height

                let angle
                if (!choice)
                {
                    ctx.fillStyle = Color.from(fillColor).toRGBA(0.1 + 0.85 * Math.random())
                }
                else
                {
                    angle = config.directions[choice - 1]

                    gradient = ctx.createLinearGradient(
                        x - Math.cos(angle) * radius,
                        y - Math.sin(angle) * radius,
                        x + Math.cos(angle) * radius,
                        y + Math.sin(angle) * radius
                    )

                    gradient.addColorStop(0, Color.from(fillColor).toRGBA(0.1 + 0.9 * Math.random()))
                    gradient.addColorStop(1, Color.from(fillColor).toRGBA(0))
                    ctx.fillStyle = gradient
                }

                ctx.beginPath()
                ctx.moveTo(x + radius, y)
                ctx.arc(x, y, +radius, 0, TAU, true)
                ctx.fill()

                area -= Math.PI * radius * radius

            }
        }

        paint()

        canvas.addEventListener("click", paint, true)
    }
);
