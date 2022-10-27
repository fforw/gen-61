import domready from "domready"
import "./style.css"
import Color, { getLuminance } from "./Color"

import { voronoi } from "d3-voronoi"


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

function drawPolygon(polygon, palette)
{
    const last = polygon.length - 1
    const [x1, y1] = polygon[last]

    ctx.beginPath()
    ctx.moveTo(
        x1 | 0,
        y1 | 0
    )

    for (let i = 0; i < polygon.length; i++)
    {
        const [x1, y1] = polygon[i]
        ctx.lineTo(x1 | 0, y1 | 0)
    }
    ctx.fill()
    ctx.stroke()
}


/**
 * @type CanvasRenderingContext2D
 */
let ctx;
let canvas;

const resolution = 80
const FORCE_LEN = 32
const BASE_FORCE = 4000000

function drawArrow(x0, y0, x1, y1)
{
    const { width, height} = config;

    const dy = y1 - y0;
    const dx = x1 - x0;

    if (dx * dx + dy * dy > 2)
    {
        const nx = dy * 0.08
        const ny = -dx * 0.08

        const start = 0.01
        const end = 0.5

        const x2 = x0 + (x1 - x0) * start
        const y2 = y0 + (y1 - y0) * start
        const x3 = x0 + (x1 - x0) * end
        const y3 = y0 + (y1 - y0) * end

        const x4 = x0 + (x1 - x0) * (start + (end - start) * 0.6)
        const y4 = y0 + (y1 - y0) * (start + (end - start) * 0.6)

        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(x3, y3)

        ctx.moveTo(x3, y3)
        ctx.lineTo(x4 + nx, y4 + ny)
        ctx.moveTo(x3, y3)
        ctx.lineTo(x4 - nx, y4 - ny)
        ctx.stroke()
    }
}


const key = (x,y) => x + "/" + y

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

            const palette = ["#454d66", "#309975", "#58b368", "#dad873", "#efeeb4"]//["#ffa822", "#134e6f", "#ff6150", "#1ac0c6", "#dee0e6"]//randomPaletteWithBlack()

            const bgColor = palette[0 | Math.random() * palette.length]
            config.palette = palette
            config.bg = bgColor
            ctx.fillStyle = bgColor

            const fgColor = getLuminance(Color.from(bgColor)) < 10000 ? "#fff" : "#000"

            ctx.fillRect(0, 0, width, height)


            const size = Math.min(width, height)

            const pow = 0.2 + Math.random()

            let area = (width * height) * (0.15 + 0.85 * Math.random() )

            const pts = []
            const forces = []

            const sites = new Map()
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

                const len = TAU * radius
                const count = Math.floor( len/ resolution);
                const step = TAU/count
                angle = 0

                const offset = Math.floor(Math.random() * 4) * TAU / 4

                for (let i=0; i < count; i++)
                {
                    const sx = Math.round(x + Math.cos(angle) * radius)
                    const sy = Math.round(y + Math.sin(angle) * radius)
                    sites.set(key(sx,sy), pts.length)
                    pts.push([
                        sx,
                        sy
                    ])
                    forces.push([
                        Math.cos(angle + offset),
                        Math.sin(angle + offset)
                    ])

                    angle += step
                }

                area -= Math.PI * radius * radius

            }
            // console.log("SITES", sites)
            // console.log("POINTS", pts)

            const v = voronoi().extent([[0,0], [width, height]])
            const diagram = v(pts)
            // console.log("DIAGRAM", diagram)

            const polygons = diagram.polygons()
            ctx.strokeStyle = fgColor

            //polygons.forEach( p => drawPolygon(p, config.palette))

            for (let currentY = 0; currentY < height; currentY += FORCE_LEN* 0.4     )
            {
                for (let currentX = 0; currentX < width; currentX += FORCE_LEN * 0.4)
                {
                    const current = diagram.find(currentX,currentY)
                    const index = sites.get(key(current[0],current[1]))
                    const { halfedges } = diagram.cells[index]

                    const nodes = [{site: current, index}]
                    halfedges.forEach(
                        e => {
                            const { left, right } = diagram.edges[e]
                            const other = current[0] === left[0] && current[1] === left[1] ? right : left
                            if (other)
                            {
                                nodes.push(
                                    {
                                        site: other,
                                        index: sites.get(key(other[0],other[1]))
                                    }
                                )
                            }
                        }
                    )

                    let dx = 0
                    let dy = 0

                    const influences = []
                    nodes.forEach(
                        ({site, index}) => {

                            const [fx,fy] = forces[index]


                            const x = currentX - site[0]
                            const y = currentY - site[1]

                            const influence = Math.min(1, BASE_FORCE/Math.pow(x*x+y*y, 2))
                            dx += fx * influence
                            dy += fy * influence

                            influences.push(influence)
                        }
                    )
                        console.log("INFLUENCES", influences)

                    const f = 1/Math.sqrt(dx * dx + dy * dy)
                    dx *= f
                    dy *= f


                    drawArrow( currentX, currentY,currentX + dx * FORCE_LEN, currentY + dy * FORCE_LEN)
               }
            }

            // forces.forEach( (f,idx) => {
            //
            //     const [x,y] = pts[idx]
            //     const [fx,fy] = forces[idx]
            //
            //     drawArrow( x, y,x + fx * FORCE_LEN, y + fy * FORCE_LEN)
            // })
        }

        paint()

        canvas.addEventListener("click", paint, true)
    }
);
