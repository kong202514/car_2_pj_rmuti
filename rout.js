import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js"
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js"

const firebaseConfig = {
    apiKey: "AIzaSyBXn8SyiVLWui1I7RbwiHAkARvjN3-TGU0",
    authDomain: "qazx-3fc6e.firebaseapp.com",
    projectId: "qazx-3fc6e",
    storageBucket: "qazx-3fc6e.appspot.com",
    messagingSenderId: "101969041040",
    appId: "1:101969041040:web:a578a1b724e1ebf7f9aa15",
    measurementId: "G-8RFTQKJH2Y"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const originSelect = document.getElementById('originSelect')
const destinationSelect = document.getElementById('destinationSelect')
const searchButton = document.getElementById('searchButton')
const resultsContainer = document.getElementById('results-container')
const loadingMessage = document.getElementById('loading-message')

let allStops = []
let allRoutes = []
let allRouteSegments = []

function populateDropdown(selectElement, stopsData) {
    while (selectElement.children.length > 1) {
        selectElement.removeChild(selectElement.lastChild)
    }
    stopsData.sort((a, b) => a.name.localeCompare(b.name, 'th'))
    stopsData.forEach(stop => {
        const option = document.createElement('option')
        option.value = stop.id
        option.textContent = stop.name
        selectElement.appendChild(option)
    })
}

async function loadAllStopsData() {
    const snapshot = await getDocs(collection(db, 'stops'))
    allStops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function loadAllRoutesData() {
    const snapshot = await getDocs(collection(db, 'routes'))
    allRoutes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function loadAllRouteSegmentsData() {
    const snapshot = await getDocs(collection(db, 'route_segments'))
    allRouteSegments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

function renderSVGPath(nodes, container, label = '') {
    container.innerHTML = ''

    const width = 200
    const height = 120 * nodes.length + 100
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", width)
    svg.setAttribute("height", height)

    const nodeRadius = 10
    const spaceY = 120
    const centerX = width / 2
    const startY = 50

    nodes.forEach((node, index) => {
        const cx = centerX
        const cy = startY + index * spaceY

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
        circle.setAttribute("cx", cx)
        circle.setAttribute("cy", cy)
        circle.setAttribute("r", nodeRadius)
        circle.setAttribute("fill", "#807b25ff")
        circle.setAttribute("stroke", "#000")
        svg.appendChild(circle)

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
        text.setAttribute("x", cx)
        text.setAttribute("y", cy)
        text.setAttribute("text-anchor", "start")
        text.setAttribute("dominant-baseline", "middle")
        text.setAttribute("dx", "12")
        text.setAttribute("fill", "black")
        text.style.fontSize = "26px"
        text.textContent = node.label
        svg.appendChild(text)

        if (index < nodes.length - 1) {
            const arrow = document.createElementNS("http://www.w3.org/2000/svg", "line")
            arrow.setAttribute("x1", cx)
            arrow.setAttribute("y1", cy + nodeRadius)
            arrow.setAttribute("x2", cx)
            arrow.setAttribute("y2", cy + spaceY - nodeRadius)
            arrow.setAttribute("stroke", "#000000ff")
            arrow.setAttribute("stroke-width", 2)
            arrow.setAttribute("marker-end", "url(#arrow)")
            svg.appendChild(arrow)
        }
    })

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker")
    marker.setAttribute("id", "arrow")
    marker.setAttribute("markerWidth", "6")
    marker.setAttribute("markerHeight", "6")
    marker.setAttribute("refX", "5")
    marker.setAttribute("refY", "3")
    marker.setAttribute("orient", "auto-start-reverse")

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", "M0,0 L10,5 L0,10 z")
    path.setAttribute("fill", "#c2ddebff")
    marker.appendChild(path)
    defs.appendChild(marker)
    svg.appendChild(defs)

    container.appendChild(svg)
}

async function findRoute() {
    resultsContainer.innerHTML = ''
    loadingMessage.style.display = 'block'

    const origin = originSelect.value
    const destination = destinationSelect.value

    if (!origin || !destination || origin === destination) {
        loadingMessage.style.display = 'none'
        resultsContainer.innerHTML = '<p style="color:red;">กรุณาเลือกจุดต้นทางและปลายทางที่ไม่ซ้ำกัน</p>'
        return
    }

    const directRoutes = allRoutes.filter(route => {
        const stopIds = route.stops.map(s => s.stopId)
        return stopIds.includes(origin) && stopIds.includes(destination)
    })

    if (directRoutes.length > 0) {
        resultsContainer.innerHTML += '<h3>เส้นทางตรง:</h3>'
        const limitedDirectRoutes = directRoutes.slice(0, 2)
        for (const route of limitedDirectRoutes) {
            const sortedStops = [...route.stops].sort((a, b) => a.order - b.order)
            const stopList = sortedStops.map((s, i) => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return `<li>${i + 1}. ${stopData ? stopData.name : s.stopId}</li>`
            }).join('')

            resultsContainer.innerHTML += `
                <div>
                    <div><b>สาย: ${route.name}</b> - ${route.description || 'ไม่มีคำอธิบาย'}</div>
                    <ol>${stopList}</ol>
                    <div id="svg-route-${route.id}"></div>
                    <div><b>เส้นทางขากลับ:</b></div>
                    <div id="svg-route-reverse-${route.id}"></div>
                </div>`

            const nodes = sortedStops.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId }
            })
            renderSVGPath(nodes, document.getElementById(`svg-route-${route.id}`))
            renderSVGPath([...nodes].reverse(), document.getElementById(`svg-route-reverse-${route.id}`))
        }
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางตรง</p>'
    }

    // เส้นทางต่อรถ
    const transfers = []
    for (const route1 of allRoutes) {
        if (!route1.stops.some(s => s.stopId === origin)) continue
        for (const route2 of allRoutes) {
            if (route1.id === route2.id || !route2.stops.some(s => s.stopId === destination)) continue
            const transferStopId = route1.stops
                .map(s => s.stopId)
                .find(id => route2.stops.some(s2 => s2.stopId === id) && id !== origin && id !== destination)

            if (transferStopId) {
                const transferStop = allStops.find(s => s.id === transferStopId)
                transfers.push({
                    transferAt: transferStop?.name || transferStopId,
                    route1,
                    route2,
                    transferStopId
                })
            }
        }
    }

    if (transfers.length > 0) {
        resultsContainer.innerHTML += '<h3>เส้นทางต่อรถ (1 จุด):</h3>'
        const limitedTransfers = transfers.slice(0, 1)
        for (let i = 0; i < limitedTransfers.length; i++) {
            const t = limitedTransfers[i]
            const stops1 = [...t.route1.stops].sort((a, b) => a.order - b.order)
            const stops2 = [...t.route2.stops].sort((a, b) => a.order - b.order)

            const stopList1 = stops1.map((s) => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                const mark = s.stopId === origin ? '✅ ' : (s.stopId === t.transferStopId ? '➡️ ' : '')
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`
            }).join('')

            const stopList2 = stops2.map((s) => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                const mark = s.stopId === t.transferStopId ? '➡️ ' : (s.stopId === destination ? '🏁 ' : '')
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`
            }).join('')
 
            resultsContainer.innerHTML += `
                <div>
                    <div><b>แผนการเดินทางที่ ${i + 1}</b>: ขึ้นรถสาย ${t.route1.name}</div>
                    มาลงที่ ${t.transferAt}
                    <div>แล้วขึ้นสายที่ ${t.route2.name}</div>
                    <div>สายแรก:</div>
                    <ol>${stopList1}</ol>
                    <div>สายที่สอง:</div>
                    <ol>${stopList2}</ol>
                    <div id="svg-transfer1-${i}"></div>
                    <div id="svg-transfer2-${i}"></div>
                    <div><b>เส้นทางขากลับ:</b></div>
                    <div id="svg-transfer1-rev-${i}"></div>
                    <div id="svg-transfer2-rev-${i}"></div>
                </div>`
   

            const nodes1 = stops1.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId }
            })
            const nodes2 = stops2.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId }
            })

            renderSVGPath(nodes1, document.getElementById(`svg-transfer1-${i}`))
            renderSVGPath(nodes2, document.getElementById(`svg-transfer2-${i}`))
            renderSVGPath([...nodes2].reverse(), document.getElementById(`svg-transfer2-rev-${i}`))
            renderSVGPath([...nodes1].reverse(), document.getElementById(`svg-transfer1-rev-${i}`))
        }
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางต่อรถ</p>'
    }

    loadingMessage.style.display = 'none'
}

searchButton.addEventListener('click', findRoute)

document.addEventListener('DOMContentLoaded', async () => {
    await loadAllStopsData()
    await loadAllRoutesData()
    await loadAllRouteSegmentsData()
    populateDropdown(originSelect, allStops)
    populateDropdown(destinationSelect, allStops)
})
