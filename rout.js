import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js"
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js"

const firebaseConfig = {
    apiKey: "AIzaSyBXn8SyiVLWui1I7RbwiHAkARvjN3-TGU0",
    authDomain: "qazx-3fc6e.firebaseapp.com",
    projectId: "qazx-3fc6e",
    storageBucket: "qazx-3fc6e.firebasestorage.app",
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

async function findRoute() {
    resultsContainer.innerHTML = ''
    document.getElementById('svg-container').innerHTML = ''
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
        directRoutes.forEach(route => {
            const sortedStops = [...route.stops].sort((a, b) => a.order - b.order)
            const startIndex = sortedStops.findIndex(s => s.stopId === origin)
            const endIndex = sortedStops.findIndex(s => s.stopId === destination)

            if (startIndex === -1 || endIndex === -1) return

            const sliced = sortedStops.slice(
                Math.min(startIndex, endIndex),
                Math.max(startIndex, endIndex) + 1
            )

            const visualNodes = sliced.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                const icon = s.stopId === origin ? '✅' : (s.stopId === destination ? '🏁' : '')
                return { label: `${icon} ${stopData ? stopData.name : s.stopId}` }
            })

            resultsContainer.innerHTML += `
                <div>
                    <div><b>สาย: ${route.name}</b> - ${route.description || 'ไม่มีคำอธิบาย'}</div>
                </div>`
            renderSVGPath(visualNodes)
        })
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางตรง</p>'
    }

    // หาเส้นทางต่อรถ
    const transfers = []
    for (const route1 of allRoutes) {
        if (!route1.stops.some(s => s.stopId === origin)) continue

        for (const route2 of allRoutes) {
            if (route1.id === route2.id || !route2.stops.some(s => s.stopId === destination)) continue

            const transferStopId = route1.stops
                .map(s => s.stopId)
                .find(id => route2.stops.some(s2 => s2.stopId === id) && id !== origin && id !== destination)

            if (transferStopId) {
                transfers.push({
                    transferStopId,
                    route1,
                    route2
                })
            }
        }
    }

    if (transfers.length > 0) {
        resultsContainer.innerHTML += '<h3>เส้นทางต่อรถ (1 จุด):</h3>'
        transfers.forEach((t, i) => {
            const stops1 = [...t.route1.stops].sort((a, b) => a.order - b.order)
            const stops2 = [...t.route2.stops].sort((a, b) => a.order - b.order)

            const idxStart = stops1.findIndex(s => s.stopId === origin)
            const idxTransfer1 = stops1.findIndex(s => s.stopId === t.transferStopId)
            const path1 = stops1.slice(Math.min(idxStart, idxTransfer1), Math.max(idxStart, idxTransfer1) + 1)

            const idxTransfer2 = stops2.findIndex(s => s.stopId === t.transferStopId)
            const idxEnd = stops2.findIndex(s => s.stopId === destination)
            const path2 = stops2.slice(Math.min(idxTransfer2, idxEnd), Math.max(idxTransfer2, idxEnd) + 1)

            const visualNodes = [...path1, ...path2.slice(1)].map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                const icon = s.stopId === origin ? '✅' :
                    s.stopId === t.transferStopId ? '➡️' :
                        s.stopId === destination ? '🏁' : ''
                return { label: `${icon} ${stopData ? stopData.name : s.stopId}` }
            })

            resultsContainer.innerHTML += `
  <div style="border:1px solid #ccc; padding:10px; margin-bottom:15px; border-radius:5px;">
    <div><b>แผนการเดินทางที่ ${i + 1}</b></div>
    <div>ขึ้นรถที่จุดต้นทาง: <strong>${allStops.find(s => s.id === origin)?.name || origin}</strong> โดยสาย <strong>${t.route1.name}</strong></div>
    <div>ผ่านสถานี:</div>
    <ol>
      ${path1.map(s => {
                const stopName = allStops.find(stop => stop.id === s.stopId)?.name || s.stopId
                const mark = s.stopId === origin ? '🚩' : (s.stopId === t.transferStopId ? '🔄 จุดต่อรถ' : '')
                return `<li>${mark} ${stopName}</li>`
            }).join('')}
    </ol>
    <div>ต่อรถที่สถานี: <strong>${t.transferAt}</strong></div>
    <div>ขึ้นรถสาย <strong>${t.route2.name}</strong> จากสถานี <strong>${t.transferAt}</strong> ไปยังปลายทางที่ <strong>${allStops.find(s => s.id === destination)?.name || destination}</strong></div>
    <div>ผ่านสถานี:</div>
    <ol>
      ${path2.map(s => {
                const stopName = allStops.find(stop => stop.id === s.stopId)?.name || s.stopId
                const mark = s.stopId === t.transferStopId ? '🔄 จุดต่อรถ' : (s.stopId === destination ? '🏁 ปลายทาง' : '')
                return `<li>${mark} ${stopName}</li>`
            }).join('')}
    </ol>
  </div>
`

            renderSVGPath(visualNodes)
        })
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางต่อรถ</p>'
    }

    loadingMessage.style.display = 'none'
}

function renderSVGPath(nodes) {
    const svgContainer = document.getElementById('svg-container')
    svgContainer.innerHTML = '' // clear old

    const width = 120 * nodes.length + 100
    const height = 200
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", width)
    svg.setAttribute("height", height)

    const nodeRadius = 10
    const spaceX = 120
    const startX = 50
    const centerY = height / 2

    nodes.forEach((node, index) => {
        const cx = startX + index * spaceX
        const cy = centerY

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
        circle.setAttribute("cx", cx)
        circle.setAttribute("cy", cy)
        circle.setAttribute("r", nodeRadius)
        circle.setAttribute("fill", "#807b25ff")
        circle.setAttribute("stroke", "#000")
        svg.appendChild(circle)


        // อยากให้ตัวหนังสือเอียงขึ้นข้างบน 45 องศา
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text")
        label.setAttribute("x", cx) // ขยับไปทางขวานิดหน่อย 
        label.setAttribute("y", cy - 5) // ขยับขึ้นนิดหน่อย
        label.setAttribute("text-anchor", "middle")
        label.setAttribute("fill", "black")
        label.setAttribute("transform", `rotate(-300 ${cx} ${cy - 5})`)
        label.style.fontSize = "22px"
        label.textContent = node.label
        svg.appendChild(label)


        if (index < nodes.length - 1) {
            const arrow = document.createElementNS("http://www.w3.org/2000/svg", "line")
            arrow.setAttribute("x1", cx + nodeRadius)
            arrow.setAttribute("y1", cy)
            arrow.setAttribute("x2", cx + spaceX - nodeRadius)
            arrow.setAttribute("y2", cy)
            arrow.setAttribute("stroke", "#000000ff")
            arrow.setAttribute("stroke-width", 2)
            arrow.setAttribute("marker-end", "url(#arrow)")
            svg.appendChild(arrow)
        }
    })

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker")
    marker.setAttribute("id", "arrow")
    marker.setAttribute("markerWidth", "10")
    marker.setAttribute("markerHeight", "10")
    marker.setAttribute("refX", "0")
    marker.setAttribute("refY", "3")
    marker.setAttribute("orient", "auto")
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", "M0,0 L0,6 L9,3 z")
    path.setAttribute("fill", "#c2ddebff")
    marker.appendChild(path)
    defs.appendChild(marker)
    svg.appendChild(defs)

    svgContainer.appendChild(svg)
}

searchButton.addEventListener('click', findRoute)

document.addEventListener('DOMContentLoaded', async () => {
    await loadAllStopsData()
    await loadAllRoutesData()
    await loadAllRouteSegmentsData()
    populateDropdown(originSelect, allStops)
    populateDropdown(destinationSelect, allStops)
})
