import domready from "domready"
import "./style.css"
import Color, { getLuminance } from "./Color"

import { voronoi } from "d3-voronoi"
import { randomPaletteWithBlack } from "./randomPalette"


const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;
const DEG2RAD_FACTOR = TAU / 360;

const resolution = 80
const FORCE_LEN = 18
const BASE_FORCE = 5000000

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





function wrap(n, max)
{
    const m = n % max
    if (m < 0)
    {
        return max + m
    }
    else
    {
        return Math.abs(m)
    }
}


function step( flowMap, data)
{
    const { width, height } = config

    const line  = width * 4
    const offset = (x,y) => Math.round(y) * line + Math.round(x) * 4

    let off = 0
    for (let y = 0; y < height; y++)
    {
        for (let x = 0; x < width; x++)
        {
            const ox = flowMap[off++]
            const oy = flowMap[off++]

            let dx = Math.floor(ox)
            let dy = Math.floor(oy)
            let fx = ox - dx
            let fy = oy - dy

            const src0 = (wrap(y + dy, height) * width + wrap(x + dx, width)) * 4
            const src1 = (wrap(y + dy, height) * width + wrap(x + dx + 1, width)) * 4
            const src2 = (wrap(y + dy + 1, height) * width + wrap(x + dx, width)) * 4
            const src3 = (wrap(y + dy + 1, height) * width + wrap(x + dx + 1, width)) * 4
            const dst = (y * width + x) * 4

            const tlr = data[src0    ]
            const tlg = data[src0 + 1]
            const tlb = data[src0 + 2]
            const trr = data[src1    ]
            const trg = data[src1 + 1]
            const trb = data[src1 + 2]
            const blr = data[src2    ]
            const blg = data[src2 + 1]
            const blb = data[src2 + 2]
            const brr = data[src3    ]
            const brg = data[src3 + 1]
            const brb = data[src3 + 2]

            const r0 = tlr + (trr - tlr) * fx
            const g0 = tlg + (trg - tlg) * fx
            const b0 = tlb + (trb - tlb) * fx
            const r1 = blr + (brr - blr) * fx
            const g1 = blg + (brg - blg) * fx
            const b1 = blb + (brb - blb) * fx

            data[dst    ] = Math.round(r0 + (r1 - r0) * fy)
            data[dst + 1] = Math.round(g0 + (g1 - g0) * fy)
            data[dst + 2] = Math.round(b0 + (b1 - b0) * fy)
        }
    }
}

class Job
{
    running = true

    constructor(lifeTime, fn)
    {

        const tick = () => {

            fn();

            if (lifeTime-- < 0)
            {
                this.running = false
            }

            if (this.running)
            {
                requestAnimationFrame(tick)
            }

        }
        requestAnimationFrame(tick)
    }
}

function randomAlpha()
{
    return 0.33 + 0.62 * Math.random()
}

let job = null;


class FlowMap {
    diagram = null
    sites = null
    forces = null
    nodesCache = new Map()

    constructor(diagram, sites, forces)
    {
        this.diagram = diagram
        this.sites = sites
        this.forces = forces
    }

    getFlow(currentX, currentY)
    {
        const { diagram, sites, forces, nodesCache } = this
        
        const current = diagram.find(currentX, currentY)
        const index = sites.get(key(current[0], current[1]))

        let nodes = nodesCache.get(index)
        if (!nodes)
        {
            // noinspection SpellCheckingInspection
            const { halfedges } = diagram.cells[index]

            nodes = [{site: current, index}]
            halfedges.forEach(
                e => {
                    const {left, right} = diagram.edges[e]
                    const other = current[0] === left[0] && current[1] === left[1] ? right : left
                    if (other)
                    {
                        nodes.push(
                            {
                                site: other,
                                index: sites.get(key(other[0], other[1]))
                            }
                        )
                    }
                }
            )

            nodesCache.set(index, nodes)
        }

        let dx = 0
        let dy = 0

        const influences = []
        nodes.forEach(
            ({site, index}) => {

                const [fx, fy] = forces[index]

                const x = currentX - site[0]
                const y = currentY - site[1]

                const influence = Math.min(1, BASE_FORCE / Math.pow(x * x + y * y, 2))
                dx += fx * influence
                dy += fy * influence

                influences.push(influence)
            }
        )
        //console.log("INFLUENCES", influences)

        const f = 1 / Math.sqrt(dx * dx + dy * dy)
        dx *= f
        dy *= f
        return [dx, dy]
    }

    createFlowMap(width, height)
    {
        const flowMap = new Float32Array(width * height * 2)

        let off = 0
        for (let y = 0; y < height; y++)
        {
            for (let x = 0; x < width; x++)
            {
                const [dx, dy] = this.getFlow(x, y)

                flowMap[off++] = dx
                flowMap[off++] = dy
            }
        }

        return flowMap
    }


    static create(width, height, diagram, sites, forces)
    {
        return new FlowMap(diagram, sites, forces).createFlowMap(width, height)
    }
}


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

            if (job)
            {
                job.running = false
                job = null
            }

            const palette = randomPaletteWithBlack()

            const bgColor = palette[0 | Math.random() * palette.length]
            config.palette = palette
            config.bg = bgColor
            ctx.fillStyle = bgColor

            const fgColor = getLuminance(Color.from(bgColor)) < 10000 ? "#fff" : "#000"

            ctx.fillRect(0, 0, width, height)


            const size = Math.min(width, height)

            const pow = 0.2 + Math.random()

            let area = (width * height) * (0.25 + 0.75 * Math.random() )

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
                    ctx.fillStyle = Color.from(fillColor).toRGBA(randomAlpha())
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

                    gradient.addColorStop(0, Color.from(fillColor).toRGBA(0.33 + 0.62 * Math.random()))
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

            ctx.strokeStyle = fgColor

            // const polygons = diagram.polygons()
            // polygons.forEach( p => drawPolygon(p, config.palette))

            const flowMap = FlowMap.create(width, height, diagram, sites, forces)

            const imageData = ctx.getImageData(0,0,width,height)
            const { data } = imageData

            job = new Job(
                Math.round(5 + Math.random() * 20),
                () => {
                    step(flowMap, data)
                    ctx.putImageData(imageData, 0, 0)
                }
            )
        }

        paint()

        canvas.addEventListener("click", paint, true)
    }
);
