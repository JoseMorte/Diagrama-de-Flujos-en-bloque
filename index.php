<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8">
  <title>Diagrama de bloques exacto</title>
  <link rel="stylesheet" href="styleOK.css">
</head>

<body>
  <h2>Editor de flujo desde producto</h2>

  <textarea id="datos" rows="6" cols="80">[
  ["A", "V", "B", "C", "Z"],
  ["D", "B", "C", "Z"],
  ["E", "C","V","Z"],
  ["F", "B", "Z"]
]
</textarea>
  <button onclick="generarBloques()">Generar diagrama</button>


  <div id="diagrama"></div>

  <!-- HTML para el modal de la tbaa editable-->
  <div id="modalEditorFlujo" class="modalFlujo" style="display: none;">
    <div class="modalContenido">
      <h3>Editar Flujo de Producción</h3>
      <div id="editorWrapper" class="editorWrapper">

        <!-- Aquí se renderiza toda la tabla: cabecera + filas -->
        <div id="editorFlujo" class="gridEditorFlujo"></div>

        <!-- Botones -->
        <div class="botonesModal">
          <button id="btnAgregarColumna">➕ Añadir Columna</button>
          <button id="btnAgregarFila">➕ Añadir Fila</button>
          <button id="btnGuardarEditor">Guardar cambios</button>
          <button id="btnCancelarEditor">Cancelar</button>
        </div>

      </div>
    </div>
  </div>

  <script src="scriptOK.js"></script>
</body>

</html>