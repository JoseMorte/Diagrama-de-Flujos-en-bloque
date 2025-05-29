//FLUJO DE DEPARTAMENTOS 
//Procesadores de info para el diagrama de bloques
function transformarDepartamentosPorDiasAProcesos(listaDepartamentos, listaMateriales) {
    const tiempos = ["0", "24", "48", "72", "96"];
    const departamentosPorTiempo = {};

    // 1. Agrupar materiales por id_departamento
    const materialesPorDepartamento = {};
    listaMateriales.forEach(material => {
        const idDep = material.id_departamento;
        if (!materialesPorDepartamento[idDep]) {
            materialesPorDepartamento[idDep] = [];
        }
        materialesPorDepartamento[idDep].push(material.nombre_material);
    });

    // 2. Agrupar departamentos por tiempo y asociar material y color
    listaDepartamentos.forEach(dep => {
        const tiempo = String(dep.tiempo || "0");
        const id = dep.id_departamento || dep.id;
        const nombre = dep.descripcion?.trim();
        if (!nombre) return;

        if (!departamentosPorTiempo[tiempo]) {
            departamentosPorTiempo[tiempo] = [];
        }

        departamentosPorTiempo[tiempo].push({
            id: id,
            nombre: nombre,
            material: materialesPorDepartamento[id]?.join(", ") || null,
            color_estado: dep.color_estado || null
        });
    });

    // 3. Ordenar por tiempos: Día 5 (96) → primero
    const tiemposOrdenados = tiempos.filter(t => departamentosPorTiempo[t]).reverse();

    // 4. Construir procesos (filas del diagrama)
    const procesos = [];
    const maxLongitud = Math.max(...tiemposOrdenados.map(t => departamentosPorTiempo[t].length));

    for (let i = 0; i < maxLongitud; i++) {
        const fila = [];
        tiemposOrdenados.forEach(t => {
            const dep = departamentosPorTiempo[t][i];
            if (dep) fila.push(dep);
        });

        if (fila.length > 0) {
            // Buscar color para Empaquetado si existe en listaDepartamentos
            const empaquetado = listaDepartamentos.find(d => d.descripcion?.toLowerCase().includes("empaquetado"));
            fila.push({
                id: "5",
                nombre: "Empaquetado",
                material: null,
                color_estado: empaquetado?.color_estado || "#108510" // valor por defecto si no lo encuentra
            });
            procesos.push(fila);
        }
    }

    return procesos;
}

function transformarFlujoDesdeBD_Estructurado(data, materiales, datosDepartamentos) {
    if (!Array.isArray(data)) return [];

    // Agrupar materiales por departamento
    const materialesPorDepartamento = {};
    materiales.forEach(material => {
        const id = String(material.id_departamento);
        if (!materialesPorDepartamento[id]) materialesPorDepartamento[id] = [];
        materialesPorDepartamento[id].push(material.nombre_material);
    });

    // Mapear info de departamentos por ID
    const infoDepartamentos = {};
    const departamentos = datosDepartamentos?.data || [];
    departamentos.forEach(dep => {
        const id = String(dep.id || dep.id_departamento);
        infoDepartamentos[id] = {
            nombre: (dep.descripcion || "").trim(),
            color_estado: dep.color_estado || null
        };
    });

    // Buscar color de Empaquetado (si existe)
    let colorEmpaquetado = "#108510";
    const infoEmpaq = departamentos.find(dep =>
        (dep.descripcion || "").toLowerCase().includes("empaquetado")
    );
    if (infoEmpaq?.color_estado) {
        colorEmpaquetado = infoEmpaq.color_estado;
    }

    // Procesar cada fila manteniendo espacios vacíos
    const procesos = data.map(filaRaw => {
        const filaTransformada = filaRaw.map(celda => {
            if (!celda || typeof celda !== "object" || !celda.id_departamento) {
                // Conservar la celda vacía tal cual
                return celda;
            }

            const id = String(celda.id_departamento);
            const info = infoDepartamentos[id] || {};

            return {
                id,
                nombre: info.nombre || `Dept ${id}`,
                material: materialesPorDepartamento[id]?.join(", ") || null,
                color_estado: info.color_estado || null
            };
        });

        // Añadir Empaquetado como última columna
        filaTransformada.push({
            id: "5",
            nombre: "Empaquetado",
            material: null,
            color_estado: colorEmpaquetado
        });

        return filaTransformada;
    });

    return procesos;
}
  
//Funciones para generar el diagrama de bloques
function generarBloques(procesos) {
    //Reordenamiento de filas de forma automatica buscando las maximas fusiones posibles.
    procesos = reordenarFilas(procesos);

    const contenedor = document.getElementById("diagrama");
    contenedor.innerHTML = "";
    contenedor.style.display = "grid";

    const columnas = Math.max(...procesos.map(p => p.length));
    const filas = procesos.length;
    contenedor.style.gridTemplateColumns = `repeat(${columnas * 2 - 1}, auto)`;
    contenedor.style.gridTemplateRows = `repeat(${filas}, auto)`;

    const mapaDepartamentos = {}; // { id: [ { filaIdx, colIdx } ] }
    const referencias = {}; // { id: departamento }

    procesos.forEach((fila, filaIdx) => {
        fila.forEach((estado, colIdx) => {
            if (!estado || !estado.id) return;
            const id = estado.id;
            if (!mapaDepartamentos[id]) mapaDepartamentos[id] = [];
            mapaDepartamentos[id].push({ filaIdx, colIdx });
            if (!referencias[id]) referencias[id] = estado;
        });
    });

    Object.entries(mapaDepartamentos).forEach(([id, posiciones]) => {
        const columnasUnicas = new Set(posiciones.map(pos => pos.colIdx));

        // Si están en más de una columna → agrupar por columna y procesar cada grupo
        if (columnasUnicas.size > 1) {
            // Agrupar posiciones por columna
            const posicionesPorColumna = {};
            posiciones.forEach(pos => {
                if (!posicionesPorColumna[pos.colIdx]) {
                    posicionesPorColumna[pos.colIdx] = [];
                }
                posicionesPorColumna[pos.colIdx].push(pos);
            });

            // Procesar cada columna por separado
            Object.entries(posicionesPorColumna).forEach(([col, posicionesEnColumna]) => {
                const colNum = parseInt(col);
                const filaIdxsOrdenadas = [...new Set(posicionesEnColumna.map(p => p.filaIdx))].sort((a, b) => a - b);

                // Aplicar la misma lógica de fusión que se usa para una sola columna
                const tramosValidos = [];
                let tramoActual = [filaIdxsOrdenadas[0]];

                for (let i = 1; i < filaIdxsOrdenadas.length; i++) {
                    const filaAnterior = filaIdxsOrdenadas[i - 1];
                    const filaActual = filaIdxsOrdenadas[i];

                    // Verificar si hay conflictos en las filas intermedias
                    let hayConflicto = false;
                    for (let j = filaAnterior + 1; j < filaActual; j++) {
                        const celda = procesos[j]?.[colNum];
                        if (celda && celda.id && celda.id !== id) {
                            hayConflicto = true;
                            break;
                        }
                    }

                    if (hayConflicto) {
                        // Finalizar tramo actual y empezar uno nuevo
                        tramosValidos.push([...tramoActual]);
                        tramoActual = [filaActual];
                    } else {
                        // Continuar con el tramo actual
                        tramoActual.push(filaActual);
                    }
                }

                // Añadir el último tramo
                if (tramoActual.length > 0) {
                    tramosValidos.push(tramoActual);
                }

                // Renderizar cada tramo válido para esta columna
                tramosValidos.forEach(tramo => {
                    renderTramo(tramo, colNum, referencias[id]);
                });
            });
            return;
        }

        // Si están en la misma columna → verificar si se pueden fusionar respetando huecos
        const col = posiciones[0].colIdx;
        const filaIdxsOrdenadas = [...new Set(posiciones.map(p => p.filaIdx))].sort((a, b) => a - b);

        //Tramos que respetan las filas vacías
        const tramosValidos = [];
        let tramoActual = [filaIdxsOrdenadas[0]];

        for (let i = 1; i < filaIdxsOrdenadas.length; i++) {
            const filaAnterior = filaIdxsOrdenadas[i - 1];
            const filaActual = filaIdxsOrdenadas[i];

            // Verificar si hay conflictos en las filas intermedias
            let hayConflicto = false;
            for (let j = filaAnterior + 1; j < filaActual; j++) {
                const celda = procesos[j]?.[col];
                if (celda && celda.id && celda.id !== id) {
                    hayConflicto = true;
                    break;
                }
            }

            if (hayConflicto) {
                // Finalizar tramo actual y empezar uno nuevo
                tramosValidos.push([...tramoActual]);
                tramoActual = [filaActual];
            } else {
                // Continuar con el tramo actual
                tramoActual.push(filaActual);
            }
        }

        // Añadir el último tramo
        if (tramoActual.length > 0) {
            tramosValidos.push(tramoActual);
        }

        // Renderizar cada tramo válido
        tramosValidos.forEach(tramo => {
            renderTramo(tramo, col, referencias[id]);
        });
    });

    function renderTramo(filas, col, estado) {
        if (!estado || filas.length === 0) return;

        const div = document.createElement("div");
        div.className = "bloqueDiagrama";
        div.style.borderColor = estado.color_estado || "#ccc";

        const label = document.createElement("div");
        label.className = "nombreDepartamentoDiagrama";
        label.textContent = estado.nombre;
        div.appendChild(label);

        if (estado.material) {
            const mat = document.createElement("div");
            mat.className = "materialDiagrama";
            mat.textContent = estado.material;
            div.appendChild(mat);
        }

        div.style.gridColumn = `${(col + 1) * 2 - 1}`;

        //Solo usar las filas que realmente contienen el departamento
        if (filas.length === 1) {
            // Caso simple: una sola fila
            div.style.gridRow = `${filas[0] + 1}`;
        } else {
            // Caso múltiple: verificar si las filas son consecutivas
            const filasOrdenadas = [...filas].sort((a, b) => a - b);
            const sonConsecutivas = filasOrdenadas.every((fila, index) => {
                if (index === 0) return true;
                return fila === filasOrdenadas[index - 1] + 1;
            });

            if (sonConsecutivas) {
                // Filas consecutivas: usar rango
                div.style.gridRow = `${Math.min(...filas) + 1} / ${Math.max(...filas) + 2}`;
            } else {
                // Filas no consecutivas: renderizar por separado
                filas.forEach(fila => {
                    renderTramo([fila], col, estado);
                });
                return; // Salir sin añadir este div
            }
        }

        div.style.alignSelf = "stretch";
        div.style.display = "flex";
        div.style.flexDirection = "column";
        div.style.justifyContent = "center";
        div.style.alignItems = "center";

        contenedor.appendChild(div);
    }

    // Flechas horizontales por fila (sin cambios)
    const ultimaColumnaGrid = columnas * 2 - 1;
    for (let filaIdx = 0; filaIdx < filas; filaIdx++) {
        const proceso = procesos[filaIdx];
        if (proceso && proceso.length > 1) {
            const primerCol = 0;
            const flechaHorizontal = document.createElement("div");
            flechaHorizontal.className = "flecha-horizontal";
            flechaHorizontal.style.gridRow = filaIdx + 1;
            flechaHorizontal.style.gridColumn = `${primerCol * 2 + 1} / ${ultimaColumnaGrid + 2}`;

            const lineaHorizontal = document.createElement("div");
            lineaHorizontal.className = "linea-horizontal";
            flechaHorizontal.appendChild(lineaHorizontal);

            const puntaFlecha = document.createElement("div");
            puntaFlecha.className = "punta-flecha";
            puntaFlecha.textContent = "→";
            flechaHorizontal.appendChild(puntaFlecha);

            contenedor.prepend(flechaHorizontal);
        }
    }
}

//SISTEMA DE REORDENAMIENTO DE FILAS
function reordenarFilas(procesos) {
    if (!procesos || procesos.length <= 1) return procesos;

    // Crear copia profunda para no mutar el original
    let procesosModificados = procesos.map(fila => [...fila]);

    console.log("=== INICIO REORDENAR FILAS ===");
    console.log("Procesos originales:");
    console.table(procesosModificados.map(fila => fila.map(dep => dep?.id || "")));

    // Inicializar mapa de rastreo de posiciones
    const mapaRastreoGlobal = new Map();
    inicializarMapaRastreo(procesosModificados, mapaRastreoGlobal);

    // 1. Identificar oportunidades de fusión SIN MOVIMIENTOS HACIA ATRÁS
    const oportunidadesFusion = identificarOportunidadesFusionSeguras(procesosModificados);
    console.log("Oportunidades de fusión seguras encontradas:", oportunidadesFusion);

    // 2. Aplicar optimizaciones respetando el flujo
    procesosModificados = aplicarOptimizacionesRespetandoFlujo(procesosModificados, oportunidadesFusion, mapaRastreoGlobal);

    // 3. Normalizar tamaño
    const maxColumnas = Math.max(...procesosModificados.map(fila => fila.length));
    procesosModificados.forEach(fila => {
        while (fila.length < maxColumnas) {
            fila.push("");
        }
    });

    console.log("=== RESULTADO FINAL ===");
    console.table(procesosModificados.map(fila => fila.map(dep => dep?.id || "")));

    return procesosModificados;
}

function inicializarMapaRastreo(procesos, mapaRastreo) {
    procesos.forEach((fila, filaIdx) => {
        fila.forEach((estado, colIdx) => {
            if (estado && estado.id) {
                mapaRastreo.set(estado.id, {
                    fila: filaIdx,
                    col: colIdx,
                    estadoCompleto: estado
                });
            }
        });
    });
    console.log("🗺️ Mapa de rastreo inicializado:", Array.from(mapaRastreo.entries()));
}

function identificarOportunidadesFusionSeguras(procesos) {
    const mapaDepartamentos = {};

    // Mapear todas las posiciones de cada departamento
    procesos.forEach((fila, filaIdx) => {
        fila.forEach((estado, colIdx) => {
            if (estado && estado.id) {
                const id = estado.id;
                if (!mapaDepartamentos[id]) mapaDepartamentos[id] = [];
                mapaDepartamentos[id].push({ filaIdx, colIdx, estado });
            }
        });
    });

    const oportunidades = [];

    Object.entries(mapaDepartamentos).forEach(([depId, posiciones]) => {
        if (posiciones.length > 1) {
            // NUEVA LÓGICA: Solo considerar fusiones que no requieran movimientos hacia atrás
            const oportunidadSegura = analizarOportunidadSegura(procesos, depId, posiciones);

            if (oportunidadSegura && oportunidadSegura.potencialFusion > 0) {
                console.log(`✅ Oportunidad segura para ${depId}:`, oportunidadSegura);
                oportunidades.push(oportunidadSegura);
            } else {
                console.log(`❌ Departamento ${depId} requeriría movimientos hacia atrás - DESCARTADO`);
            }
        }
    });

    // Ordenar por potencial de fusión
    return oportunidades.sort((a, b) => b.potencialFusion - a.potencialFusion);
}

function analizarOportunidadSegura(procesos, depId, posiciones) {
    // Analizar por columnas para encontrar la mejor estrategia SIN movimientos hacia atrás
    const porColumna = {};
    posiciones.forEach(pos => {
        if (!porColumna[pos.colIdx]) porColumna[pos.colIdx] = [];
        porColumna[pos.colIdx].push(pos.filaIdx);
    });

    let mejorEscenario = null;
    let maxBeneficio = 0;

    // Evaluar cada columna como posible objetivo
    Object.entries(porColumna).forEach(([col, filas]) => {
        const columna = parseInt(col);

        // Calcular beneficio si consolidamos hacia esta columna
        const beneficio = calcularBeneficioSeguro(procesos, depId, columna, posiciones);

        if (beneficio.puntuacion > maxBeneficio) {
            maxBeneficio = beneficio.puntuacion;
            mejorEscenario = {
                columnaObjetivo: columna,
                beneficio: beneficio,
                movimientosSegurosPosibles: beneficio.movimientosSegurosPosibles
            };
        }
    });

    if (mejorEscenario) {
        // Generar movimientos seguros
        const movimientosNecesarios = generarMovimientosHaciaAdelante(
            procesos, depId, mejorEscenario.columnaObjetivo, posiciones
        );

        return {
            departamento: depId,
            columnaObjetivo: mejorEscenario.columnaObjetivo,
            posiciones: posiciones,
            potencialFusion: maxBeneficio,
            movimientosNecesarios: movimientosNecesarios,
            escenario: mejorEscenario
        };
    }

    return null;
}

function calcularBeneficioSeguro(procesos, depId, columnaObjetivo, posiciones) {
    let puntuacion = 0;
    let movimientosSegurosPosibles = 0;

    // Posiciones ya en la columna objetivo
    const posicionesEnObjetivo = posiciones.filter(p => p.colIdx === columnaObjetivo);

    // Posiciones que podrían moverse HACIA ADELANTE a la columna objetivo
    const posicionesMovebles = posiciones.filter(p => {
        // Solo permitir movimientos hacia adelante (columna mayor) o intercambios de filas
        return p.colIdx < columnaObjetivo || p.colIdx === columnaObjetivo;
    });

    if (posicionesEnObjetivo.length > 1) {
        // Ya hay múltiples instancias en la columna objetivo
        puntuacion += (posicionesEnObjetivo.length - 1) * 10; // Peso alto para fusiones ya posibles

        // Verificar si pueden hacerse consecutivas mediante intercambios
        const filasEnObjetivo = posicionesEnObjetivo.map(p => p.filaIdx).sort((a, b) => a - b);
        const intercambiosNecesarios = calcularIntercambiosParaConsecutivas(procesos, depId, columnaObjetivo, filasEnObjetivo);

        if (intercambiosNecesarios.length > 0) {
            puntuacion += intercambiosNecesarios.length * 5; // Bonificación por intercambios posibles
        }
    }

    // Evaluar movimientos laterales seguros (solo hacia adelante)
    posiciones.forEach(p => {
        if (p.colIdx < columnaObjetivo) {
            // Movimiento hacia adelante - PERMITIDO
            if (puedeMoverseSinObstaculos(procesos, p.filaIdx, p.colIdx, columnaObjetivo)) {
                puntuacion += 8; // Peso alto para movimientos seguros
                movimientosSegurosPosibles++;
            } else if (puedeMoversConReorganizacion(procesos, p.filaIdx, p.colIdx, columnaObjetivo)) {
                puntuacion += 4; // Peso medio para movimientos que requieren reorganización
                movimientosSegurosPosibles++;
            }
        }
        // Si p.colIdx > columnaObjetivo, sería movimiento hacia atrás - PROHIBIDO
    });

    return {
        puntuacion: puntuacion,
        movimientosSegurosPosibles: movimientosSegurosPosibles
    };
}

function generarMovimientosHaciaAdelante(procesos, depId, columnaObjetivo, posiciones) {
    const movimientos = [];

    // 1. Intercambios de filas para hacer consecutivas las posiciones ya en columna objetivo
    const posicionesEnObjetivo = posiciones.filter(p => p.colIdx === columnaObjetivo);
    if (posicionesEnObjetivo.length > 1) {
        const filasObjetivo = posicionesEnObjetivo.map(p => p.filaIdx).sort((a, b) => a - b);
        const intercambios = calcularIntercambiosParaConsecutivas(procesos, depId, columnaObjetivo, filasObjetivo);
        movimientos.push(...intercambios);
    }

    // 2. Movimientos laterales SOLO hacia adelante
    posiciones.forEach(pos => {
        if (pos.colIdx < columnaObjetivo) {
            // Solo permitir movimientos hacia adelante
            movimientos.push({
                tipo: 'movimiento_lateral_seguro',
                filaIdx: pos.filaIdx,
                colOrigen: pos.colIdx,
                colDestino: columnaObjetivo,
                departamento: depId,
                direccion: 'adelante' // Marcador para validación
            });
        }
    });

    return movimientos;
}

function calcularIntercambiosParaConsecutivas(procesos, depId, columna, filasOrdenadas) {
    const intercambios = [];

    for (let i = 1; i < filasOrdenadas.length; i++) {
        const filaAnterior = filasOrdenadas[i - 1];
        const filaActual = filasOrdenadas[i];

        // Si no son consecutivas, necesitamos intercambio
        if (filaActual !== filaAnterior + 1) {
            // Buscar una fila entre medias que podamos intercambiar
            for (let filaIntermedia = filaAnterior + 1; filaIntermedia < filaActual; filaIntermedia++) {
                if (esIntercambioSeguroParaFlujo(procesos, filaIntermedia, filaActual, depId, columna)) {
                    intercambios.push({
                        tipo: 'intercambio_filas_seguro',
                        fila1: filaIntermedia,
                        fila2: filaActual,
                        objetivo: 'hacer_consecutivas',
                        departamento: depId,
                        columna: columna
                    });
                    break; // Solo el primer intercambio válido
                }
            }
        }
    }

    return intercambios;
}

function esIntercambioSeguroParaFlujo(procesos, fila1, fila2, depId, columna) {
    // Verificar que el intercambio no cause movimientos hacia atrás para otros departamentos
    const fila1Contenido = procesos[fila1] || [];
    const fila2Contenido = procesos[fila2] || [];

    // Verificar cada posición del intercambio
    for (let col = 0; col < Math.max(fila1Contenido.length, fila2Contenido.length); col++) {
        const dep1 = fila1Contenido[col];
        const dep2 = fila2Contenido[col];

        // Si hay departamentos, verificar que el intercambio no los mueva hacia atrás en el flujo
        if (dep1 && dep1.id) {
            // dep1 se movería de fila1 a fila2
            if (!esMovimientoAceptableEnFlujo(dep1.id, fila1, fila2, col)) {
                return false;
            }
        }

        if (dep2 && dep2.id) {
            // dep2 se movería de fila2 a fila1  
            if (!esMovimientoAceptableEnFlujo(dep2.id, fila2, fila1, col)) {
                return false;
            }
        }
    }

    return true;
}

function esMovimientoAceptableEnFlujo(depId, filaOrigen, filaDestino, columna) {
    // Para el flujo de trabajo, solo consideramos la posición en la columna
    // Los intercambios de filas son generalmente aceptables si no afectan el orden de columnas
    // Esto es más permisivo que los movimientos laterales
    return true; // Los intercambios de filas preservan el flujo de columnas
}

function puedeMoverseSinObstaculos(procesos, fila, colOrigen, colDestino) {
    // Verificar que la posición destino esté vacía o sea extensible
    if (colDestino >= procesos[fila].length) {
        return true; // Puede extender la fila
    }

    const estadoDestino = procesos[fila][colDestino];
    return !estadoDestino || estadoDestino === "";
}

function puedeMoversConReorganizacion(procesos, fila, colOrigen, colDestino) {
    // Verificar si moviendo obstáculos hacia adelante podemos hacer espacio
    if (colDestino >= procesos[fila].length) {
        return true;
    }

    const obstaculo = procesos[fila][colDestino];
    if (!obstaculo || obstaculo === "") {
        return true;
    }

    // Verificar si el obstáculo puede moverse hacia adelante
    for (let nuevaCol = colDestino + 1; nuevaCol < procesos[fila].length + 3; nuevaCol++) {
        if (nuevaCol >= procesos[fila].length || !procesos[fila][nuevaCol] || procesos[fila][nuevaCol] === "") {
            return true; // El obstáculo puede moverse hacia adelante
        }
    }

    return false;
}

function aplicarOptimizacionesRespetandoFlujo(procesos, oportunidades, mapaRastreoGlobal) {
    console.log("=== APLICANDO OPTIMIZACIONES RESPETANDO FLUJO ===");

    // Consolidar solo movimientos seguros
    const movimientosSegur = consolidarMovimientosSegur(oportunidades);
    console.log("Movimientos seguros consolidados:", movimientosSegur);

    // Aplicar movimientos seguros con rastreo
    aplicarMovimientosSegursConRastreo(procesos, movimientosSegur, mapaRastreoGlobal);

    return procesos;
}

function consolidarMovimientosSegur(oportunidades) {
    const movimientosUnicos = new Map();
    const intercambiosRealizados = new Set();

    // Recopilar movimientos seguros
    const movimientosSegurs = [];
    oportunidades.forEach(oportunidad => {
        console.log(`\nOptimización segura para ${oportunidad.departamento} hacia columna ${oportunidad.columnaObjetivo}`);

        oportunidad.movimientosNecesarios.forEach(movimiento => {
            // VALIDACIÓN CRÍTICA: Verificar que no sea movimiento hacia atrás
            if (movimiento.tipo === 'movimiento_lateral_seguro') {
                if (movimiento.colDestino > movimiento.colOrigen) {
                    console.log(`✅ Movimiento lateral seguro: ${movimiento.departamento} col ${movimiento.colOrigen}→${movimiento.colDestino}`);
                    movimientosSegurs.push(movimiento);
                } else {
                    console.log(`❌ BLOQUEADO: Movimiento hacia atrás para ${movimiento.departamento} col ${movimiento.colOrigen}→${movimiento.colDestino}`);
                }
            } else if (movimiento.tipo === 'intercambio_filas_seguro') {
                console.log(`✅ Intercambio seguro: filas ${movimiento.fila1}↔${movimiento.fila2}`);
                movimientosSegurs.push(movimiento);
            }
        });
    });

    // Filtrar duplicados
    movimientosSegurs.forEach(movimiento => {
        if (movimiento.tipo === 'intercambio_filas_seguro') {
            const fila1 = Math.min(movimiento.fila1, movimiento.fila2);
            const fila2 = Math.max(movimiento.fila1, movimiento.fila2);
            const claveIntercambio = `intercambio_${fila1}_${fila2}`;

            if (!intercambiosRealizados.has(claveIntercambio)) {
                intercambiosRealizados.add(claveIntercambio);
                movimientosUnicos.set(claveIntercambio, {
                    ...movimiento,
                    fila1: fila1,
                    fila2: fila2
                });
            }
        } else if (movimiento.tipo === 'movimiento_lateral_seguro') {
            const claveMovimiento = `lateral_${movimiento.filaIdx}_${movimiento.colOrigen}_${movimiento.colDestino}`;

            if (!movimientosUnicos.has(claveMovimiento)) {
                movimientosUnicos.set(claveMovimiento, movimiento);
            }
        }
    });

    // Priorizar intercambios antes que movimientos laterales
    return Array.from(movimientosUnicos.values()).sort((a, b) => {
        const prioridadA = a.tipo === 'intercambio_filas_seguro' ? 0 : 1;
        const prioridadB = b.tipo === 'intercambio_filas_seguro' ? 0 : 1;
        return prioridadA - prioridadB;
    });
}

function aplicarMovimientosSegursConRastreo(procesos, movimientos, mapaRastreo) {
    console.log('🔄 Aplicando movimientos seguros con rastreo...');

    movimientos.forEach((movimiento, index) => {
        console.log(`\n--- Aplicando movimiento seguro ${index + 1}/${movimientos.length} ---`);
        console.log('Movimiento:', movimiento);

        if (movimiento.tipo === 'intercambio_filas_seguro') {
            aplicarIntercambioSeguroConRastreo(procesos, movimiento, mapaRastreo);
        } else if (movimiento.tipo === 'movimiento_lateral_seguro') {
            aplicarMovimientoLateralSeguroConRastreo(procesos, movimiento, mapaRastreo);
        }

        console.log('Estado matriz después:', procesos.map(fila => fila.map(dep => dep?.id || "")));
    });
}

function aplicarIntercambioSeguroConRastreo(procesos, movimiento, mapaRastreo) {
    const { fila1, fila2, departamento } = movimiento;

    console.log(`🔄 Intercambio seguro: filas ${fila1} ↔ ${fila2} para departamento ${departamento}`);

    // Guardar las filas originales
    const filaOriginal1 = [...procesos[fila1]];
    const filaOriginal2 = [...procesos[fila2]];

    // Realizar el intercambio
    procesos[fila1] = filaOriginal2;
    procesos[fila2] = filaOriginal1;

    // Actualizar el mapa de rastreo
    actualizarMapaTrasIntercambio(fila1, fila2, filaOriginal1, filaOriginal2, mapaRastreo);

    console.log(`✅ Intercambio seguro completado: filas ${fila1} ↔ ${fila2}`);
}

function aplicarMovimientoLateralSeguroConRastreo(procesos, movimiento, mapaRastreo) {
    let { filaIdx, colOrigen, colDestino, departamento } = movimiento;

    // VALIDACIÓN CRÍTICA: Verificar que sigue siendo un movimiento hacia adelante
    if (colDestino <= colOrigen) {
        console.error(`❌ CRÍTICO: Intento de movimiento hacia atrás bloqueado para ${departamento}: col ${colOrigen}→${colDestino}`);
        return false;
    }

    // Verificar posición actualizada
    const posicionActualizada = mapaRastreo.get(departamento);
    if (posicionActualizada &&
        (posicionActualizada.fila !== filaIdx || posicionActualizada.col !== colOrigen)) {
        console.log(`📍 Posición actualizada para ${departamento}: de [${filaIdx},${colOrigen}] a [${posicionActualizada.fila},${posicionActualizada.col}]`);
        filaIdx = posicionActualizada.fila;
        colOrigen = posicionActualizada.col;

        // RE-VALIDAR que sigue siendo movimiento hacia adelante
        if (colDestino <= colOrigen) {
            console.error(`❌ CRÍTICO: Después de actualización, sería movimiento hacia atrás para ${departamento}: col ${colOrigen}→${colDestino}`);
            return false;
        }
    }

    console.log(`➡️ Movimiento lateral seguro: ${departamento} de [${filaIdx},${colOrigen}] a [${filaIdx},${colDestino}] (HACIA ADELANTE)`);

    // Verificar que el departamento está donde esperamos
    if (!procesos[filaIdx] || procesos[filaIdx][colOrigen]?.id !== departamento) {
        console.warn(`⚠️ Departamento ${departamento} no encontrado en posición esperada [${filaIdx},${colOrigen}]`);
        return false;
    }

    // Aplicar movimiento seguro
    if (puedeMoverseSinObstaculos(procesos, filaIdx, colOrigen, colDestino)) {
        realizarMovimientoLateral(procesos, filaIdx, colOrigen, colDestino);

        // Actualizar mapa de rastreo
        mapaRastreo.set(departamento, {
            fila: filaIdx,
            col: colDestino,
            estadoCompleto: procesos[filaIdx][colDestino]
        });

        console.log(`✅ Movimiento lateral seguro completado: ${departamento} → [${filaIdx},${colDestino}]`);
        return true;

    } else {
        // Intentar reorganización manteniendo dirección hacia adelante
        const alternativa = buscarAlternativaSE(procesos, filaIdx, colOrigen, colDestino, departamento);
        if (alternativa.posible && alternativa.mantieneFlujo) {
            aplicarAlternativaSegura(procesos, alternativa);

            mapaRastreo.set(departamento, {
                fila: filaIdx,
                col: colDestino,
                estadoCompleto: procesos[filaIdx][colDestino]
            });

            console.log(`✅ Movimiento alternativo seguro aplicado`);
            return true;
        } else {
            console.log(`❌ No se pudo realizar movimiento seguro sin alterar flujo`);
            return false;
        }
    }
}

function buscarAlternativaSE(procesos, fila, colOrigen, colDestino, depId) {
    // Solo alternativas que mantengan el flujo hacia adelante
    if (colDestino < procesos[fila].length) {
        const obstaculo = procesos[fila][colDestino];
        if (obstaculo && obstaculo.id) {
            // Buscar dónde mover el obstáculo (SOLO HACIA ADELANTE)
            for (let nuevaCol = colDestino + 1; nuevaCol < procesos[fila].length + 3; nuevaCol++) {
                if (nuevaCol >= procesos[fila].length || !procesos[fila][nuevaCol] || procesos[fila][nuevaCol] === "") {
                    return {
                        posible: true,
                        mantieneFlujo: true,
                        tipo: 'mover_obstaculo_adelante',
                        filaObstaculo: fila,
                        colObstaculo: colDestino,
                        nuevaColObstaculo: nuevaCol,
                        filaObjetivo: fila,
                        colOrigen: colOrigen,
                        colDestino: colDestino
                    };
                }
            }
        }
    }

    // Extender fila como última opción
    return {
        posible: true,
        mantieneFlujo: true,
        tipo: 'extender_fila',
        filaObjetivo: fila,
        colOrigen: colOrigen,
        colDestino: colDestino
    };
}

function aplicarAlternativaSegura(procesos, alternativa) {
    if (alternativa.tipo === 'mover_obstaculo_adelante') {
        // Mover obstáculo hacia adelante primero
        realizarMovimientoLateral(procesos, alternativa.filaObstaculo, alternativa.colObstaculo, alternativa.nuevaColObstaculo);
        // Luego mover el departamento objetivo
        realizarMovimientoLateral(procesos, alternativa.filaObjetivo, alternativa.colOrigen, alternativa.colDestino);

    } else if (alternativa.tipo === 'extender_fila') {
        // Simplemente extender y mover
        realizarMovimientoLateral(procesos, alternativa.filaObjetivo, alternativa.colOrigen, alternativa.colDestino);
    }
}

function actualizarMapaTrasIntercambio(fila1, fila2, filaOriginal1, filaOriginal2, mapaRastreo) {
    console.log(`🗺️ Actualizando mapa tras intercambio ${fila1} ↔ ${fila2}`);

    // Actualizar posiciones de departamentos en fila1 (que ahora tiene contenido de fila2)
    filaOriginal2.forEach((estado, col) => {
        if (estado && estado.id) {
            const nuevaPosicion = { fila: fila1, col: col, estadoCompleto: estado };
            mapaRastreo.set(estado.id, nuevaPosicion);
            console.log(`  📍 ${estado.id}: [${fila2},${col}] → [${fila1},${col}]`);
        }
    });

    // Actualizar posiciones de departamentos en fila2 (que ahora tiene contenido de fila1)
    filaOriginal1.forEach((estado, col) => {
        if (estado && estado.id) {
            const nuevaPosicion = { fila: fila2, col: col, estadoCompleto: estado };
            mapaRastreo.set(estado.id, nuevaPosicion);
            console.log(`  📍 ${estado.id}: [${fila1},${col}] → [${fila2},${col}]`);
        }
    });
}

function realizarMovimientoLateral(procesos, fila, colOrigen, colDestino) {
    const estado = procesos[fila][colOrigen];

    // Extender fila si es necesario
    while (procesos[fila].length <= colDestino) {
        procesos[fila].push("");
    }

    procesos[fila][colDestino] = estado;
    procesos[fila][colOrigen] = "";
}

function validarNoMovimientosHaciaAtras(movimientos) {
    return movimientos.every(mov => {
        if (mov.tipo === 'movimiento_lateral_seguro' || mov.tipo === 'movimiento_lateral') {
            return mov.colDestino > mov.colOrigen;
        }
        return true; // Intercambios son siempre válidos
    });
}

function validarEstadoMatriz(procesos, descripcion = '') {
    console.log(`\n🔍 Validando matriz ${descripcion}:`);

    const departamentosEncontrados = new Map();
    const posicionesVacias = [];
    let hayDuplicados = false;

    procesos.forEach((fila, filaIdx) => {
        fila.forEach((celda, colIdx) => {
            if (celda && celda.id) {
                if (departamentosEncontrados.has(celda.id)) {
                    console.error(`❌ Departamento ${celda.id} duplicado en [${filaIdx},${colIdx}] y [${departamentosEncontrados.get(celda.id).fila},${departamentosEncontrados.get(celda.id).col}]`);
                    hayDuplicados = true;
                } else {
                    departamentosEncontrados.set(celda.id, { fila: filaIdx, col: colIdx });
                }
            } else {
                posicionesVacias.push({ fila: filaIdx, col: colIdx });
            }
        });
    });
    console.log(`✅ Departamentos únicos encontrados: ${departamentosEncontrados.size}`);
    console.log(`📍 Posiciones vacías: ${posicionesVacias.length}`);

    return {
        departamentos: departamentosEncontrados,
        posicionesVacias: posicionesVacias,
        esValida: !hayDuplicados
    };
}
//FIN AUTOMATIZACIÓN DE REORDENAMIENTO DE FILAS


//Peticiones AJAX para renderizar el flujo de departamentos
function obtenerMaterialesDepartamentos() {
    return new Promise((resolve, reject) => {
        try {
            $.post('', {
                accion: 'get_materiales_departamentos',
                hash: hash_lista_id_departamentos_configurados,
                //departamentos: array_ids_departamentos
            }, function (data) {
                console.log('RESPUESTA MATERIALES', data);
                const res = JSON.parse(data);
                if (res.codigo !== 'OK') {
                    console.error('ERROR', res.codigo, res.mensaje);
                    reject(res.mensaje || 'Error desconocido');
                    return;
                }

                if (res.tiempo !== undefined) {
                    const mensaje = res.cantidad_consultas !== undefined
                        ? `${res.tiempo}. en ${res.cantidad_consultas} consultas`
                        : `Tiempo de consulta: ${res.tiempo}.`;
                    showToast(mensaje, 3000);
                }

                const materiales = res.data;
                console.log('Obtener materiales por departamentos', materiales);
                resolve(materiales);
            });
        } catch (error) {
            console.error('ERROR en obtenerMaterialesDepartamentos', error);
            reject(error);
        }
    });
}

function obtenerInfoDepartamentosDesdeArray(array_ids) {
    // Forzamos a string y ordenamos para que coincida
    const array_ids_str = JSON.stringify(array_ids.map(id => String(id)).sort());

    return new Promise((resolve, reject) => {
        $.post('', {
            accion: 'departamentos_get_info_basica_por_array_ids',
            array_ids: array_ids_str
        }, function (data) {
            try {
                const res = JSON.parse(data);
                resolve(res);
            } catch (e) {
                reject(e);
            }
        });
    });
}

function obtenerFlujoDepartamentosPorArrayIds(array_ids) {
  return new Promise((resolve, reject) => {
    $.post('', {
      accion: 'get_flujo_departamentos_por_array_ids',
      array_ids: JSON.stringify(array_ids)  // 👈 ¡Muy importante!
    }, function (data) {
      try {
        const res = JSON.parse(data);
        resolve(res);
      } catch (e) {
        console.error("❌ JSON inválido recibido desde servidor", data);
        reject(e);
      }
    });
  });
}




//Reutilizacion de funciones (Utilidad)
function formatearNombreArchivoDesdeArray(arrayIds) {
    if (!Array.isArray(arrayIds)) return null;
    const idsOrdenados = [...arrayIds].sort((a, b) => parseInt(a) - parseInt(b));
    return idsOrdenados.join('_') + '.jpg';
}

function capturarYGuardarImagen(arrayIdsDepartamentos, base64Imagen) {
    const nombreArchivo = formatearNombreArchivoDesdeArray(arrayIdsDepartamentos);
    if (!nombreArchivo) {
        console.warn('⛔ No se pudo generar el nombre del archivo para guardar el flujo.');
        return;
    }

    $.post('', {
        accion: 'guardar_imagen_flujo',
        nombre_archivo: nombreArchivo,
        imagen: base64Imagen
    }, function (data) {
        try {
            const res = JSON.parse(data);
            if (res.codigo !== 'OK') {
                console.warn('⚠️ Error al guardar imagen:', res.mensaje);
            } else {
                console.log('✅ Imagen del flujo guardada correctamente.');
            }
        } catch (e) {
            console.error('❌ Error procesando respuesta del guardado de imagen.', e);
        }
    });
}

async function cargarMaterialesDepartamentos() {
    try {
        const materialesPorDepartamento = await obtenerMaterialesDepartamentos();
        console.log('Materiales guardados:', materialesPorDepartamento);


    } catch (error) {
        console.error('Error al cargar materiales:', error);
    }
}

function cargarFlujoProductoDepartamentos(lista_id_departamentos_configurados, array_ids) {
    array_ids = array_ids.map(id => String(id)).sort();
    console.log(' array_ids:', JSON.stringify(array_ids));

    Promise.all([
        obtenerFlujoDepartamentosPorArrayIds(array_ids),  // flujo desde BD
        obtenerMaterialesDepartamentos(),                 // materiales
        obtenerInfoDepartamentosDesdeArray(array_ids)     // departamentos usados en ese flujo
    ])
    .then(([flujo, materiales, datosDepartamentos]) => {
        lista_materiales_departamentos = materiales;

        console.log('📦 Flujo recibido:', flujo);
        console.log('📦 Materiales:', materiales);
        console.log('📦 Departamentos usados:', datosDepartamentos);

        let procesosTransformados = [];

        if (Array.isArray(flujo.data) && flujo.data.length > 0) {
            procesosTransformados = transformarFlujoDesdeBD_Estructurado(
                flujo.data,
                materiales,
                datosDepartamentos
            );
            console.log('✅ Usando transformador estructurado desde BD');
        } else {
            procesosTransformados = transformarDepartamentosPorDiasAProcesos(
                lista_id_departamentos_configurados,
                materiales
            );
            console.log('⚠️ Usando fallback por días');
        }

        generarBloques(procesosTransformados);

        /*setTimeout(() => {
            html2canvas(document.getElementById("diagrama")).then(canvas => {
                const base64Imagen = canvas.toDataURL("image/jpeg", 1.0);
                capturarYGuardarImagen(array_ids, base64Imagen);
            });
        }, 1000); // retraso tras render*/


        flujoExistente = Array.isArray(flujo.data) && flujo.data.length > 0;
        if (flujoExistente) {
            console.log('EL FLUJO ES ESTE', flujo.data);
            generar_ids_desde_json(flujo.data);
            $('.btn_reiniciar_flujo').removeClass('btn_bloqueado');
        } else {
            $('.btn_reiniciar_flujo').addClass('btn_bloqueado');
        }
    })
        .catch(error => {
            console.error('❌ Error en carga de datos:', error);
        });
}

// NO AÑADIDO PERO FALTA FLUJO DE BACKEND

// Includes/Function(Consulta) --> Controller(cases) --> js(Llamada AJAX al case) --> View(Plantilla HTML)  