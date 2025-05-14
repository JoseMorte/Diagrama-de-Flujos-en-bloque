function generarBloques() {
    const entrada = document.getElementById("datos").value;
    let procesos = reordenarFilas(JSON.parse(entrada));
    const contenedor = document.getElementById("diagrama");
    contenedor.innerHTML = "";
    contenedor.style.display = "grid";

    const columnas = Math.max(...procesos.map(p => p.length));
    const filas = procesos.length;
    contenedor.style.gridTemplateColumns = `repeat(${columnas * 2 - 1}, auto)`;
    contenedor.style.gridTemplateRows = `repeat(${filas}, auto)`;

    const posiciones = {};
    procesos.forEach((fila, filaIdx) => {
        fila.forEach((estado, colIdx) => {
            if (!posiciones[estado]) posiciones[estado] = [];
            if (!posiciones[estado].includes(filaIdx)) {
                posiciones[estado].push(filaIdx);
            }
        });
    });

    const rangosVisibles = {}; // estado -> array de rangos [start, end]

    Object.entries(posiciones).forEach(([estado, filasOcupadas]) => {
        const col = procesos.find(p => p.includes(estado))?.indexOf(estado);
        if (col === -1) return;

        const ordenadas = [...filasOcupadas].sort((a, b) => a - b);
        let tramo = [ordenadas[0]];
        rangosVisibles[estado] = [];

        for (let i = 1; i < ordenadas.length; i++) {
            const anterior = ordenadas[i - 1];
            const actual = ordenadas[i];
            let hayConflicto = false;
            for (let j = anterior + 1; j < actual; j++) {
                if (procesos[j]?.[col] && procesos[j][col] !== estado) {
                    hayConflicto = true;
                    break;
                }
            }

            if (hayConflicto) {
                renderTramo(tramo, col, estado);
                rangosVisibles[estado].push([Math.min(...tramo), Math.max(...tramo)]);
                tramo = [];
            }
            tramo.push(actual);
        }

        if (tramo.length) {
            renderTramo(tramo, col, estado);
            rangosVisibles[estado].push([Math.min(...tramo), Math.max(...tramo)]);
        }
    });

    function renderTramo(filas, col, estado) {
        const div = document.createElement("div");
        div.className = "bloque";
        if (estado.includes("Z")) div.setAttribute("data-color", "empaquetado");
        else if (estado.includes("F") || estado.includes("B") || estado.includes("L")) div.setAttribute("data-color", "laser");
        else if (estado.includes("I")) div.setAttribute("data-color", "impresion");
        else div.setAttribute("data-color", "otros");

        div.textContent = estado;
        div.style.gridColumn = `${(col + 1) * 2 - 1}`;
        div.style.gridRow = `${Math.min(...filas) + 1} / ${Math.max(...filas) + 2}`;
        div.style.alignSelf = "stretch";
        div.style.display = "flex";
        div.style.justifyContent = "center";
        div.style.alignItems = "center";

        if (estado.includes("Z")) div.style.borderColor = "#5d3820";
        else if (estado.includes("F") || estado.includes("B") || estado.includes("L")) div.style.borderColor = "#3f3f8c";
        else if (estado.includes("I")) div.style.borderColor = "#4fa5c8";
        else div.style.borderColor = "#4c3072";

        contenedor.appendChild(div);
    }

    // Encontrar la última columna del grid (independientemente del nombre del estado)
    const ultimaColumnaGrid = columnas * 2 - 1;

    // Dibujar flechas horizontales continuas por cada fila/proceso
    for (let filaIdx = 0; filaIdx < filas; filaIdx++) {
        const proceso = procesos[filaIdx];
        if (proceso && proceso.length > 1) {
            // Siempre iniciamos desde la primera columna
            const primerCol = 0;

            // Crear una flecha horizontal continua
            const flechaHorizontal = document.createElement("div");
            flechaHorizontal.className = "flecha-horizontal";

            // Posicionar la flecha desde la primera columna hasta la última columna del grid
            flechaHorizontal.style.gridRow = filaIdx + 1;
            // La flecha ahora va desde el inicio del primer bloque hasta el final del grid
            flechaHorizontal.style.gridColumn = `${primerCol * 2 + 1} / ${ultimaColumnaGrid + 2}`;

            // Añadir la línea horizontal
            const lineaHorizontal = document.createElement("div");
            lineaHorizontal.className = "linea-horizontal";
            flechaHorizontal.appendChild(lineaHorizontal);

            // Añadir la punta de flecha al final
            const puntaFlecha = document.createElement("div");
            puntaFlecha.className = "punta-flecha";
            puntaFlecha.textContent = "→";
            flechaHorizontal.appendChild(puntaFlecha);

            // Insertar al inicio para que quede por debajo de los bloques
            contenedor.prepend(flechaHorizontal);
        }
    }
}

function reordenarFilas(procesos) {
    const usadas = new Set();
    const resultado = [];

    procesos.forEach(proceso => {
        const compatibles = resultado.find(filaAgrupada =>
            filaAgrupada.every(existing =>
                !existing.some(e => proceso.includes(e))
            )
        );
        if (compatibles) {
            compatibles.push(proceso);
        } else {
            resultado.push([proceso]);
        }
    });

    return resultado.flat();
}