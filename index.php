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

  <script src="scriptOK.js"></script>
</body>

</html>