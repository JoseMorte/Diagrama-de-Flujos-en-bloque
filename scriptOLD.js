function generarBloques() {
    const entrada = document.getElementById("datos").value;
    let procesos = reordenarFilas(JSON.parse(entrada));
    const contenedor = document.getElementById("diagrama");
    contenedor.innerHTML = "";
    contenedor.style.display = "grid";

    const columnas = Math.max(...procesos.map(p => p.length));
    const filas = procesos.length;

    // 1. Contar presencia de cada estado
    const ocurrencias = {};
    procesos.forEach(p => {
        new Set(p).forEach(etapa => {
            ocurrencias[etapa] = (ocurrencias[etapa] || 0) + 1;
        });
    });

    // 2. Ordenar procesos para agrupar los que comparten estados frecuentes
    procesos.sort((a, b) => {
        const pesoA = a.reduce((sum, e) => sum + (ocurrencias[e] || 0), 0);
        const pesoB = b.reduce((sum, e) => sum + (ocurrencias[e] || 0), 0);
        return pesoB - pesoA; // primero los más pesados
    });

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

    const colocados = new Set();

    Object.entries(posiciones).forEach(([estado, filasOcupadas]) => {
        const col = procesos.find(p => p.includes(estado))?.indexOf(estado);
        if (col === -1) return;

        // Ordenamos las filas que comparten ese estado
        const ordenadas = [...filasOcupadas].sort((a, b) => a - b);

        // Dividimos en tramos contiguos y sin conflictos
        let tramo = [ordenadas[0]];
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
                tramo = [];
            }
            tramo.push(actual);
        }
        if (tramo.length) {
            renderTramo(tramo, col, estado);
        }
    });

    function renderTramo(filas, col, estado) {
        const div = document.createElement("div");
        div.className = "bloque";
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


    // Dibujar flechas largas por proceso
    procesos.forEach((fila, filaIdx) => {
        for (let i = 0; i < fila.length - 1; i++) {
            const colOrigen = (i + 1) * 2 - 1;
            const colDestino = (i + 2) * 2 - 1;

            const flecha = document.createElement("div");
            flecha.className = "flecha";
            flecha.textContent = "→";
            flecha.style.gridRow = filaIdx + 1;
            flecha.style.gridColumn = `${colOrigen + 1} / ${colDestino}`;
            flecha.style.display = "flex";
            flecha.style.alignItems = "center";
            flecha.style.justifyContent = "center";

            contenedor.appendChild(flecha);
        }
    });

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

