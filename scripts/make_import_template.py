#!/usr/bin/env python3
"""Genera public/plantilla-programas-groulevel.xlsx (plantilla del importador de /admin)."""
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent

# (columna, obligatoria, descripción, ejemplo)
COLUMNS = [
    ("INSTITUCION", True, "Nombre de la institución. Si no existe en Groulevel, se crea automáticamente.", "Datapath"),
    ("NOMBRE_PROGRAMA", True, "Nombre del programa tal como lo publica la institución.", "Power BI para Analistas"),
    ("URL_FINAL", True, "URL oficial del programa. Sirve para reconocer si el programa ya existe.", "https://www.ejemplo.com/programas/power-bi-analistas"),
    ("AREA_PRINCIPAL", True, "Área tecnológica (ver lista desplegable).", "Data Analytics"),
    ("TIPO_PROGRAMA", False, "Curso, Especialización, Certificación, Bootcamp, Diplomado, Programa Ejecutivo, Maestría.", "Curso"),
    ("TIPO_PUBLICADO", False, "Cómo lo llama la institución (Carrera, Taller, Ruta…).", "Curso"),
    ("SUBAREA", False, "Subárea o tema principal.", "Power BI"),
    ("DESCRIPCION_CORTA", False, "Resumen de 1–2 frases.", "Aprende a construir dashboards profesionales en Power BI."),
    ("OBJETIVO_PROGRAMA", False, "Lo que aprenderás. Separar con «; ».", "Modelar datos; Crear medidas DAX; Publicar reportes"),
    ("PUBLICO_OBJETIVO", False, "A quién está dirigido.", "Analistas y profesionales de negocio."),
    ("REQUISITOS", False, "Separar con «; ».", "Excel intermedio; Laptop"),
    ("CONTENIDO", False, "Módulos separados con « | ». Ej.: Módulo 1: Título | Módulo 2: Título", "Módulo 1: Power Query | Módulo 2: Modelado y DAX | Módulo 3: Dashboards"),
    ("HERRAMIENTAS", False, "Separar con « | ».", "Power BI | Excel | DAX"),
    ("CERTIFICACION", False, "Descripción del certificado. Si menciona «internacional» o «preparación», se clasifica así.", "Certificado digital de la institución"),
    ("CERTIFICADO_INCLUIDO", False, "Sí / No", "Sí"),
    ("DOCENTE_PRINCIPAL", False, "Nombre(s) separados con « | » (si no se llena PERFIL_DOCENTE).", "Ana Torres"),
    ("PERFIL_DOCENTE", False, "«Nombre: perfil» separados con « | ».", "Ana Torres: Head of BI en Empresa X"),
    ("LINKEDIN_DOCENTE", False, "URLs separadas con « | », en el mismo orden que los docentes.", ""),
    ("DURACION_TEXTO", False, "Duración tal como se publica.", "6 semanas (24 horas)"),
    ("HORAS_CURSO", False, "Número de horas totales.", 24),
    ("DURACION_SEMANAS", False, "Número de semanas.", 6),
    ("FRECUENCIA", False, "Días de clase.", "Martes y jueves"),
    ("HORARIO", False, "Horario.", "7:00 p. m. a 10:00 p. m."),
    ("MODALIDAD", False, "Síncrono (en vivo), Asíncrono (grabado), Híbrido, Presencial.", "Síncrono"),
    ("NIVEL", False, "Básico, Intermedio, Avanzado.", "Intermedio"),
    ("IDIOMA", False, "Idioma de dictado.", "Español"),
    ("PLATAFORMA", False, "Plataforma de clases.", "Zoom"),
    ("MONEDA", False, "PEN o USD. Sin moneda, el precio no se publica.", "PEN"),
    ("PRECIO_REGULAR", False, "Precio regular (número). 0 = gratis.", 890),
    ("PRECIO_OFERTA", False, "Precio promocional (número), si existe.", 690),
    ("CUOTAS", False, "Número de cuotas.", 3),
    ("PRECIO_CUOTA", False, "Monto de cada cuota.", 230),
    ("FECHA_INICIO", False, "Fecha AAAA-MM-DD. Fechas pasadas se ignoran.", "2026-11-10"),
    ("FECHA_INICIO_TEXTO", False, "Texto de inicio (ej. «Inicios mensuales»).", "10 de noviembre"),
    ("INSCRIPCIONES_ABIERTAS", False, "Sí / No", "Sí"),
    ("CLASES_EN_VIVO", False, "Sí / No", "Sí"),
    ("CLASES_GRABADAS", False, "Sí / No", "Sí"),
    ("PROYECTO_FINAL", False, "Sí / No", "Sí"),
    ("MENTORIA", False, "Sí / No", ""),
    ("ACCESO_DE_POR_VIDA", False, "Sí / No", ""),
    ("BOLSA_TRABAJO", False, "Sí / No", ""),
    ("COMUNIDAD", False, "Sí / No", ""),
    ("PAIS_INSTITUCION", False, "País de la sede de la institución.", "Perú"),
    ("PAIS_PROGRAMA", False, "País del programa.", "Perú"),
    ("FECHA_EXTRACCION", False, "Fecha en que se verificó la información (AAAA-MM-DD).", "2026-10-05"),
]

AREAS = ["Data Analytics", "Data Science", "Data Engineering", "Artificial Intelligence", "Machine Learning", "Generative AI",
         "Software Development", "Cloud Computing", "Cybersecurity", "DevOps", "Product Management", "UX/UI",
         "Business Analytics", "Digital Business", "Digital Marketing", "Project Management", "Tecnología"]
LISTS = {
    "AREA_PRINCIPAL": AREAS,
    "TIPO_PROGRAMA": ["Curso", "Especialización", "Certificación", "Bootcamp", "Diplomado", "Programa Ejecutivo", "Maestría"],
    "MODALIDAD": ["Síncrono", "Asíncrono", "Híbrido", "Presencial"],
    "NIVEL": ["Básico", "Intermedio", "Avanzado"],
    "MONEDA": ["PEN", "USD"],
}
YES_NO = {"CERTIFICADO_INCLUIDO", "INSCRIPCIONES_ABIERTAS", "CLASES_EN_VIVO", "CLASES_GRABADAS", "PROYECTO_FINAL", "MENTORIA",
          "ACCESO_DE_POR_VIDA", "BOLSA_TRABAJO", "COMUNIDAD"}


def build(path: Path, rows=None):
    wb = Workbook()
    ws = wb.active
    ws.title = "CURSOS"
    head_fill = PatternFill("solid", fgColor="091225")
    req_fill = PatternFill("solid", fgColor="246BFE")
    for j, (col, required, _, example) in enumerate(COLUMNS, start=1):
        c = ws.cell(row=1, column=j, value=col)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = req_fill if required else head_fill
        ws.column_dimensions[get_column_letter(j)].width = max(14, min(40, len(col) + 6))
    for i, row in enumerate(rows or [[ex for (_, _, _, ex) in COLUMNS]], start=2):
        for j, v in enumerate(row, start=1):
            ws.cell(row=i, column=j, value=v if v != "" else None)
    ws.freeze_panes = "C2"
    names = [c[0] for c in COLUMNS]
    for col, values in LISTS.items():
        dv = DataValidation(type="list", formula1='"' + ",".join(values) + '"', allow_blank=True)
        letter = get_column_letter(names.index(col) + 1)
        dv.add(f"{letter}2:{letter}2000")
        ws.add_data_validation(dv)
    dv = DataValidation(type="list", formula1='"Sí,No"', allow_blank=True)
    for col in YES_NO:
        letter = get_column_letter(names.index(col) + 1)
        dv.add(f"{letter}2:{letter}2000")
    ws.add_data_validation(dv)

    info = wb.create_sheet("INSTRUCCIONES")
    info["A1"] = "Plantilla de importación de programas · Groulevel"
    info["A1"].font = Font(bold=True, size=14)
    tips = [
        "1. Llena una fila por programa en la hoja CURSOS. Puedes borrar la fila de ejemplo.",
        "2. Columnas en azul = obligatorias: INSTITUCION, NOMBRE_PROGRAMA, URL_FINAL, AREA_PRINCIPAL.",
        "3. Deja vacío (o «No especificado») lo que la institución no publique: el sitio mostrará «No publicado».",
        "4. Un programa ya existente se reconoce por su URL oficial: re-importarlo actualiza sus datos sin duplicarlo.",
        "5. Las celdas vacías nunca borran información que ya exista en Groulevel.",
        "6. Sube el archivo en www.groulevel.com/admin → Importar. Verás una vista previa antes de guardar.",
        "7. También se acepta el formato completo del relevamiento (hoja CURSOS con sus 66 columnas).",
    ]
    for i, t in enumerate(tips, start=3):
        info.cell(row=i, column=1, value=t)
    start = len(tips) + 5
    for j, h in enumerate(["Columna", "Obligatoria", "Descripción"], start=1):
        info.cell(row=start, column=j, value=h).font = Font(bold=True)
    for i, (col, required, desc, _) in enumerate(COLUMNS, start=start + 1):
        info.cell(row=i, column=1, value=col)
        info.cell(row=i, column=2, value="Sí" if required else "")
        info.cell(row=i, column=3, value=desc).alignment = Alignment(wrap_text=True)
    info.column_dimensions["A"].width = 26
    info.column_dimensions["B"].width = 12
    info.column_dimensions["C"].width = 100
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


if __name__ == "__main__":
    build(ROOT / "public" / "plantilla-programas-groulevel.xlsx")
    print("plantilla generada")
