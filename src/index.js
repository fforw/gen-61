import domready from "domready"
import "./style.css"
import Color, { getLuminance } from "./Color"

import { voronoi } from "d3-voronoi"
import { randomPaletteWithBlack } from "./randomPalette"

import queryString from "query-string"
import SimplexNoise from "simplex-noise"
const params = queryString.parse(location.search)

const errorRate = +(params.err || "0.2");


const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;
const DEG2RAD_FACTOR = TAU / 360;

const resolution = 80
const FORCE_LEN = 2
const BASE_FORCE = 5000000

const config = {
    width: 0,
    height: 0,
    palette: ["#000", "#fff"],
    bg: "#000",
    directions: [0, TAU/2]
};

let noise

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


/**
 * Key function for the FlowDistortion site map. Creates string representations for integer coordinates
 * @param {Number} x    x-coordinate
 * @param {Number} y    y-coordinate
 * @returns {string} composite key
 */
const siteKey = (x,y) => x + "/" + y

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


const toLinearPower = 2.2
const toRGBPower = 1/2.2
function toLinear(gun)
{
    return gun * gun
}
function toRGB(gun)
{
    return Math.sqrt(gun)
}


function step( flowDistortion, imageData)
{
    const { width, height } = config

    const { data } = imageData
    const { flowMap } = flowDistortion

    let off = 0
    for (let y = 0; y < height; y++)
    {
        for (let x = 0 ; x < width; x++)
        {
            const ox = flowMap[off++] * FORCE_LEN
            const oy = flowMap[off++] * FORCE_LEN

            let dx = Math.floor(ox)
            let dy = Math.floor(oy)
            let fx = ox - dx
            let fy = oy - dy

            const src0 = (wrap(y + dy, height) * width + wrap(x + dx, width)) * 4
            const src1 = (wrap(y + dy, height) * width + wrap(x + dx + 1, width)) * 4
            const src2 = (wrap(y + dy + 1, height) * width + wrap(x + dx, width)) * 4
            const src3 = (wrap(y + dy + 1, height) * width + wrap(x + dx + 1, width)) * 4
            const dst = (y * width + x) * 4

            const tlr = toLinear(data[src0    ])
            const tlg = toLinear(data[src0 + 1])
            const tlb = toLinear(data[src0 + 2])
            const trr = toLinear(data[src1    ])
            const trg = toLinear(data[src1 + 1])
            const trb = toLinear(data[src1 + 2])
            const blr = toLinear(data[src2    ])
            const blg = toLinear(data[src2 + 1])
            const blb = toLinear(data[src2 + 2])
            const brr = toLinear(data[src3    ])
            const brg = toLinear(data[src3 + 1])
            const brb = toLinear(data[src3 + 2])

            const r0 = tlr + (trr - tlr) * fx
            const g0 = tlg + (trg - tlg) * fx
            const b0 = tlb + (trb - tlb) * fx
            const r1 = blr + (brr - blr) * fx
            const g1 = blg + (brg - blg) * fx
            const b1 = blb + (brb - blb) * fx

            data[dst    ] = Math.round(toRGB(r0 + (r1 - r0) * fy))
            data[dst + 1] = Math.round(toRGB(g0 + (g1 - g0) * fy))
            data[dst + 2] = Math.round(toRGB(b0 + (b1 - b0) * fy))
        }
    }
}

class Job
{
    running = true

    constructor(lifeTime, fn, end)
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
            else
            {
                end()
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



class FlowDistortion {

    width = -1
    height = -1

    pts = []
    forces = []
    /**
     * Lookup map for look up site indexes from their coordinate keys (e.g. "10x12")
     * @type {*}
     */
    sites = new Map()

    /**
     * Voronoi diagram
     */
    diagram = null

    /**
     * Baked flow map
     * @type {Float32Array}
     */
    flowMap = null

    nodesCache = new Map()

    constructor(width, height)
    {
        this.width = width
        this.height = height
    }

    addPoint(x,y, fx,fy)
    {
        const { sites, pts, forces } = this

        sites.set(siteKey(x, y), pts.length)
        pts.push([
            x,
            y
        ])
        forces.push([
           fx, fy
        ])

    }



    getFlow(currentX, currentY)
    {
        const { diagram, sites, forces, nodesCache } = this

        const current = diagram.find(currentX, currentY)
        const index = sites.get(siteKey(current[0], current[1]))

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
                                index: sites.get(siteKey(other[0], other[1]))
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

    prepareMap()
    {
        const { width, height, pts } = this

        // console.log("SITES", sites)
        // console.log("POINTS", pts)

        const v = voronoi().extent([[0,0], [width, height]])
        const diagram = v(pts)

        // const polygons = diagram.polygons()
        // polygons.forEach( p => drawPolygon(p, config.palette))

        const flowMap = new Float32Array(width * height * 2)
        this.diagram = diagram
        this.flowMap = flowMap

        let off = 0
        const nsx = 0.005 + Math.pow(Math.random(),2) * 0.05
        const nsy = 0.005 + Math.pow(Math.random(),2) * 0.05

        for (let y = 0; y < height; y++)
        {
            for (let x = 0; x < width; x++)
            {
                const [dx, dy] = this.getFlow(x, y)

                const angle = noise.noise2D(x * nsx, y * nsy) * TAU/2

                //const angle = Math.random() * TAU
                const errX = errorRate * Math.cos(angle) + dx
                const errY = errorRate * Math.sin(angle) + dy

                const f = 1/Math.sqrt(errX*errX + errY * errY)


                flowMap[off++] = errX * f
                flowMap[off++] = errY * f
            }
        }

    }
}


function copyRandomSlices(id0, id1)
{
    const { width, height } = config

    const { data : d0 } = id0
    const { data : d1 } = id1
    
    let from1 = false
    let x = 0
    do
    {
        const slice = Math.round( 1 + 200 * Math.pow( Math.random(), 12))
        if (from1)
        {
            for (let y=0; y < height; y++)
            {
                for (let x1=0; x1 < slice; x1++)
                {
                    const off = (y * width + x + x1) * 4
                    d0[ off     ] = (d1[off    ] + d0[ off     ] * 2)/3
                    d0[ off + 1 ] = (d1[off + 1] + d0[ off + 1 ] * 2)/3
                    d0[ off + 2 ] = (d1[off + 2] + d0[ off + 2 ] * 2)/3
                }
            }

        }
        x += slice;
        from1 = !from1
    } while (x < width)

}


function logPalette(palette)
{
    console.log("%c\u00a0%c\u00a0%c\u00a0%c\u00a0%c\u00a0%c\u00a0:", ...palette.map(c => `color: ${c}; background: ${c};`), "data:", palette)
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

            noise = new SimplexNoise()

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

            const fgColor = getLuminance(Color.from(bgColor)) < 10000 ? palette[palette.length - 1] : palette[0]
            ctx.strokeStyle = fgColor

            ctx.fillRect(0, 0, width, height)


            const size = Math.min(width, height)

            const pow = 0.2 + 0.4 * Math.random()
            const fArea = 0.33 + 0.4 * Math.random()
            const circleChance = 0.2 + 0.6 * Math.random()
            let area = (width * height) * fArea
            logPalette(palette)
            console.log({ fArea, pow, circleChance} )

            const fd = new FlowDistortion(
                width,
                height
            )

            const shapes = [];

            while (area > 0)
            {
                const fillColor = getColorExcluding(bgColor)

                const choice = 0 | Math.random() * 4

                let gradient = null
                const radius = Math.round(10 + Math.pow(Math.random(), pow) * size / 5)
                const x = 0 | Math.random() * width
                const y = 0 | Math.random() * height

                let angle
                let fillStyle
                if (!choice)
                {
                    fillStyle = Color.from(fillColor).toRGBA(randomAlpha())
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
                    fillStyle = gradient
                }

                const fn = (doFill, doStroke) => {

                    ctx.fillStyle = fillStyle

                    if (Math.random() < circleChance)
                    {
                        ctx.beginPath()
                        ctx.moveTo(x + radius, y)
                        ctx.arc(x, y, +radius, 0, TAU, true)
                        if (doFill)
                        {
                            ctx.fill()
                        }
                        if (doStroke)
                        {
                            ctx.stroke()
                        }
                    }
                    else
                    {
                        const size = Math.sqrt(Math.PI) * radius
                        const hSize = size / 2
                        ctx.fillRect(x - hSize, y - hSize, size, size )
                        if (doStroke)
                        {
                            ctx.strokeRect(x - hSize, y - hSize, size, size)
                        }
                    }
                }

                fn(true, Math.random() < 0.25)
                shapes.push(fn)

                if (Math.random() < 0.8)
                {
                    const len = TAU * radius
                    const count = Math.floor( len/ resolution);
                    const step = TAU/count

                    const offset = Math.floor(Math.random() * 4) * TAU / 4
                    let angle = 0
                    for (let i = 0; i < count; i++)
                    {
                        const sx = Math.round(x + Math.cos(angle) * radius)
                        const sy = Math.round(y + Math.sin(angle) * radius)

                        const a2 = angle + offset
                        fd.addPoint(
                            sx,
                            sy,
                            Math.cos(a2),
                            Math.sin(a2)
                        )
                        angle += step
                    }

                    area -= Math.PI * radius * radius
                }
            }


            fd.prepareMap()

            const imageData = ctx.getImageData(0,0,width,height)
            const copy = ctx.getImageData(0,0,width,height)

            job = new Job(
                Math.round(4 + Math.random() * 12),
                () => {

                    shapes[0|Math.random() * shapes.length](false, true)
                    step(fd, imageData)
                    ctx.putImageData(imageData, 0, 0)
                },
                () => {
                    // copyRandomSlices(imageData, copy)
                    // ctx.putImageData(imageData, 0, 0)

                }
            )



        }

        paint()

        canvas.addEventListener("click", paint, true)
    }
);
