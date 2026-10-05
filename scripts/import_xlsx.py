#!/usr/bin/env python3
"""
Importa el relevamiento de programas (Excel "compara_learning_cursos.xlsx", hoja CURSOS)
al modelo de datos de Groulevel: src/data/courses.json, institutions.json y categories.json.

Uso:
    pip install openpyxl
    python3 scripts/import_xlsx.py ruta/al/archivo.xlsx

Criterios (solo la información necesaria):
  - Solo registros con ESTADO_EXTRACCION "Completo" o "Parcial" (descarta URLs caídas o eliminadas).
  - Descarta duplicados marcados (POSIBLE_DUPLICADO = Sí → se conserva el de menor ID).
  - Descarta programas fuera del foco tecnológico (AREA_PRINCIPAL = "Otro": finanzas, energía, derecho, MBA…).
  - "No especificado" se guarda como null: la interfaz muestra "No publicado" en vez de inventar datos.
  - IDs estables (crs-<ID_ORIGEN>) para poder re-importar sin romper URLs, favoritos ni leads.
  - Columnas de control de la extracción (fuentes, observaciones, campos inferidos) no se publican.
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
NA = {None, "", "No especificado", "no especificado", "N/A", "-"}

# ---------------------------------------------------------------------------
# Catálogos de mapeo
# ---------------------------------------------------------------------------

INSTITUTIONS = {
    # nombre en Excel: (slug, nombre público, nombre corto, tipo, color)
    "Datapath": ("datapath", "Datapath", "Datapath", "Academia especializada", "#246BFE"),
    "Coderhouse": ("coderhouse", "Coderhouse", "Coderhouse", "Academia online", "#14B8A6"),
    "UTEC Posgrado (Universidad de Ingeniería y Tecnología)": ("utec-posgrado", "UTEC Posgrado", "UTEC", "Universidad", "#0EA5E9"),
    "Pacífico Business School (Universidad del Pacífico)": ("pacifico-business-school", "Pacífico Business School", "PBS", "Escuela de negocios", "#3B4CCA"),
    "New Horizons Perú": ("new-horizons-peru", "New Horizons Perú", "NH", "Centro de capacitación TI", "#2563EB"),
    "IDAT (Instituto Idat)": ("idat", "IDAT", "IDAT", "Instituto", "#DB2777"),
    "Digital House": ("digital-house", "Digital House", "DH", "Academia online", "#7657FF"),
    "WE Educación Ejecutiva": ("we-educacion-ejecutiva", "WE Educación Ejecutiva", "WE", "Educación ejecutiva", "#F59E0B"),
    "SmartData": ("smartdata", "SmartData", "SD", "Academia especializada", "#10B981"),
    "Cibertec (Educación Continua)": ("cibertec", "Cibertec", "Cibertec", "Instituto", "#E11D48"),
    "EducaciónIT": ("educacionit", "EducaciónIT", "EIT", "Academia online", "#0891B2"),
    "Escuela de Postgrado UTP (Universidad Tecnológica del Perú)": ("utp-postgrado", "Escuela de Postgrado UTP", "UTP", "Universidad", "#DC2626"),
    "Colectivo23": ("colectivo23", "Colectivo23", "C23", "Academia especializada", "#A855F7"),
    "USIL - Escuela de Posgrado (Universidad San Ignacio de Loyola)": ("usil-posgrado", "Escuela de Posgrado USIL", "USIL", "Universidad", "#1D4ED8"),
    "UPC - Escuela de Postgrado (Universidad Peruana de Ciencias Aplicadas)": ("upc-postgrado", "Escuela de Postgrado UPC", "UPC", "Universidad", "#EF4444"),
    "Henry": ("henry", "Henry", "Henry", "Bootcamp", "#EAB308"),
    "Le Wagon": ("le-wagon", "Le Wagon", "LW", "Bootcamp", "#F43F5E"),
    "Universidad Nacional de Ingeniería - FIEECS": ("uni-fieecs", "UNI · Posgrado FIEECS", "UNI", "Universidad", "#9F1239"),
    "TripleTen": ("tripleten", "TripleTen", "TT", "Bootcamp", "#6366F1"),
    "UCAL - Universidad de Ciencias y Artes de América Latina": ("ucal", "UCAL", "UCAL", "Universidad", "#F97316"),
    "Escuela Certus": ("certus", "Escuela Certus", "Certus", "Instituto", "#0EA5E9"),
}

AREA_TO_CATEGORY = {
    "Data Analytics": "data-analytics",
    "Data Science": "data-science",
    "Data Engineering": "data-engineering",
    "Artificial Intelligence": "inteligencia-artificial",
    "Machine Learning": "machine-learning",
    "Generative AI": "ia-generativa",
    "Software Development": "desarrollo-de-software",
    "Cloud Computing": "cloud-computing",
    "Cybersecurity": "ciberseguridad",
    "DevOps": "devops",
    "Product Management": "product-management",
    "UX/UI": "ux-ui",
    "Business Analytics": "business-analytics",
    "Digital Business": "negocios-digitales",
    "Digital Marketing": "marketing-digital",
    "Project Management": "gestion-de-proyectos",
    "Tecnología": "gestion-de-ti",
}
# Excepciones puntuales dentro de "Otro" que sí son tecnológicas.
OTHER_WHITELIST = {"Certified in Risk and Information Systems Control": "gestion-de-ti"}
# Ajustes por nombre (área "Tecnología" que en realidad es ofimática).
NAME_CATEGORY_OVERRIDES = {"Actualización en Microsoft Office": "business-analytics"}

NEW_CATEGORIES = [
    {"id": "marketing-digital", "slug": "marketing-digital", "name": "Marketing Digital", "group": "Producto y Negocio",
     "description": "Growth, performance, contenidos y marketing potenciado con datos e IA.",
     "keywords": ["marketing", "growth", "seo", "ads", "community manager", "redes sociales", "contenido"]},
    {"id": "gestion-de-proyectos", "slug": "gestion-de-proyectos", "name": "Gestión de Proyectos y Agilidad", "group": "Producto y Negocio",
     "description": "Project management, metodologías ágiles y gestión de equipos de tecnología.",
     "keywords": ["project management", "scrum", "agile", "agilidad", "pmp", "gestion de proyectos"]},
    {"id": "gestion-de-ti", "slug": "gestion-de-ti", "name": "Gestión y Gobierno de TI", "group": "Infraestructura",
     "description": "Arquitectura empresarial, gobierno de TI, gestión de servicios y riesgos tecnológicos.",
     "keywords": ["itil", "cobit", "togaf", "iso 27001", "gobierno de ti", "cto", "riesgos"]},
]

TYPE_MAP = {
    "Curso": "curso", "Especialización": "especializacion", "Maestría": "maestria", "Bootcamp": "bootcamp",
    "Certificación": "certificacion", "Diplomado": "diplomado", "Programa Ejecutivo": "programa-ejecutivo",
}
OTHER_TYPE_MAP = [("taller", "curso"), ("intensivo", "bootcamp"), ("carrera", "especializacion"),
                  ("ruta", "especializacion"), ("programa", "especializacion"), ("membres", "membresia")]

MODALITY_MAP = {"Síncrono": "en-vivo", "Asíncrono": "grabado", "Híbrido": "hibrido", "Presencial": "presencial"}
LEVEL_MAP = {"Básico": "basico", "Intermedio": "intermedio", "Avanzado": "avanzado"}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def val(v):
    if v is None:
        return None
    s = str(v).strip()
    return None if s in NA else s


def num(v):
    s = val(v)
    if s is None:
        return None
    try:
        n = float(s.replace(",", ""))
    except ValueError:
        return None
    return int(n) if n.is_integer() else round(n, 2)


def yesno(v):
    s = val(v)
    return True if s == "Sí" else False if s == "No" else None


def split(v, sep):
    s = val(v)
    return [x.strip() for x in s.split(sep) if x.strip() and x.strip() not in NA] if s else []


def slugify(text):
    t = unicodedata.normalize("NFD", text.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return re.sub(r"-{2,}", "-", t)[:80].strip("-")


def clip(text, n):
    if text is None or len(text) <= n:
        return text
    cut = text[:n].rsplit(" ", 1)[0]
    return cut.rstrip(",;:.") + "…"


def program_type(r):
    t = val(r["TIPO_PROGRAMA"])
    if t in TYPE_MAP:
        return TYPE_MAP[t]
    published = (val(r["TIPO_PUBLICADO"]) or "").lower()
    for key, mapped in OTHER_TYPE_MAP:
        if key in published:
            return mapped
    return "curso"


def parse_syllabus(v):
    modules = []
    for part in split(v, " | "):
        title = re.sub(r"^(m[oó]dulo|curso|unidad|semana|ciclo|nivel)\s*\d+\s*[:.\-–]\s*", "", part, flags=re.I).strip()
        description = ""
        if ": " in title and len(title) > 60:
            title, description = [x.strip() for x in title.split(": ", 1)]
        modules.append({"title": clip(title, 140), "hours": None, "description": clip(description, 400), "topics": []})
    return modules[:40]


def parse_teachers(r):
    profiles = split(r["PERFIL_DOCENTE"], " | ")
    linkedins = split(r["LINKEDIN_DOCENTE"], " | ")
    teachers = []
    for p in profiles:
        name, _, profile = p.partition(": ")
        if not profile:
            name, profile = p, ""
        teachers.append({"name": clip(name.strip(), 80), "profile": clip(profile.strip(), 320), "linkedin": None})
    if not teachers:
        for n in split(r["DOCENTE_PRINCIPAL"], " | "):
            teachers.append({"name": clip(n, 80), "profile": "", "linkedin": None})
    for i, url in enumerate(linkedins):
        if i < len(teachers) and url.startswith("http"):
            teachers[i]["linkedin"] = url
    return teachers[:12]


def certificate(r):
    text = val(r["CERTIFICACION"])
    included = yesno(r["CERTIFICADO_INCLUIDO"])
    if text:
        low = text.lower()
        kind = "internacional" if "internacional" in low else "preparacion" if "prepar" in low else "incluye"
        return {"type": kind, "description": clip(text, 320)}
    if included:
        return {"type": "incluye", "description": "La institución indica que el programa incluye certificado."}
    return None


def start_date(r, extracted):
    s = val(r["FECHA_INICIO"])
    if not s or not re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return None
    return s if s >= extracted else None  # una fecha ya pasada no ayuda a decidir


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = list(wb["CURSOS"].iter_rows(values_only=True))
    header = rows[0]
    records = [dict(zip(header, r)) for r in rows[1:] if r[0] is not None]

    skipped = Counter()
    seen_dupes = set()
    courses, slugs = [], set()
    inst_courses = defaultdict(list)

    for r in records:
        rid = int(r["ID_ORIGEN"])
        if r["ESTADO_EXTRACCION"] not in ("Completo", "Parcial"):
            skipped["sin datos (URL caída / eliminada)"] += 1
            continue
        if val(r["POSIBLE_DUPLICADO"]) == "Sí":
            dup = num(r["ID_DUPLICADO"])
            if dup is not None and dup < rid:
                skipped["duplicado"] += 1
                continue
        name = val(r["NOMBRE_PROGRAMA"])
        area = val(r["AREA_PRINCIPAL"])
        category = NAME_CATEGORY_OVERRIDES.get(name) or AREA_TO_CATEGORY.get(area) or OTHER_WHITELIST.get(name)
        if not name or not category:
            skipped["fuera del foco tecnológico"] += 1
            continue
        inst_name = r["INSTITUCION"]
        if inst_name not in INSTITUTIONS:
            raise SystemExit(f"Institución sin mapear: {inst_name}")
        inst_slug = INSTITUTIONS[inst_name][0]

        extracted = val(r["FECHA_EXTRACCION"]) or "2026-10-01"
        currency = val(r["MONEDA"])
        regular = num(r["PRECIO_REGULAR"]) if currency in ("PEN", "USD") else None
        if regular is None and currency in ("PEN", "USD"):
            regular = num(r["PRECIO"])
        offer = num(r["PRECIO_OFERTA"]) if regular is not None else None
        discount = offer if offer is not None and regular is not None and offer < regular else None

        slug = slugify(name)
        if slug in slugs:
            slug = f"{slug}-{inst_slug}"
        n = 2
        while slug in slugs:
            slug = f"{slugify(name)}-{inst_slug}-{n}"
            n += 1
        slugs.add(slug)

        short = val(r["DESCRIPCION_CORTA"]) or val(r["OBJETIVO_PROGRAMA"]) or f"{name} — {INSTITUTIONS[inst_name][1]}."
        objectives = split(r["OBJETIVO_PROGRAMA"], "; ")
        frequency, schedule = val(r["FRECUENCIA"]), val(r["HORARIO"])
        installments = num(r["CUOTAS"])

        course = {
            "id": f"crs-{rid:04d}",
            "slug": slug,
            "name": name,
            "institution_id": f"inst-{inst_slug}",
            "category": category,
            "subcategory": val(r["SUBAREA"]),
            "program_type": program_type(r),
            "published_type": val(r["TIPO_PUBLICADO"]),
            "description": short,
            "short_description": clip(short, 200),
            "objectives": [clip(o, 260) for o in objectives][:10],
            "target_audience": clip(val(r["PUBLICO_OBJETIVO"]), 600),
            "price": regular,
            "currency": currency if currency in ("PEN", "USD") else "PEN",
            "discount_price": discount,
            "duration_hours": num(r["HORAS_CURSO"]),
            "duration_weeks": num(r["DURACION_SEMANAS"]),
            "duration_text": val(r["DURACION_TEXTO"]),
            "modality": MODALITY_MAP.get(val(r["MODALIDAD"])),
            "schedule": " · ".join(x for x in (frequency, schedule) if x) or None,
            "level": LEVEL_MAP.get(val(r["NIVEL"])),
            "start_date": start_date(r, extracted),
            "start_text": val(r["FECHA_INICIO_TEXTO"]),
            "certificate": certificate(r),
            "teachers": parse_teachers(r),
            "tools": list(dict.fromkeys(split(r["HERRAMIENTAS"], " | ")))[:20],
            "skills": [],
            "syllabus": parse_syllabus(r["CONTENIDO"]),
            "requirements": [clip(x, 220) for x in split(r["REQUISITOS"], "; ")][:10],
            "features": {
                "live_classes": yesno(r["CLASES_EN_VIVO"]),
                "recorded_classes": yesno(r["CLASES_GRABADAS"]),
                "final_project": yesno(r["PROYECTO_FINAL"]),
                "mentoring": yesno(r["MENTORIA"]),
                "lifetime_access": yesno(r["ACCESO_DE_POR_VIDA"]),
                "job_board": yesno(r["BOLSA_TRABAJO"]),
                "community": yesno(r["COMUNIDAD"]),
                "enrollment_open": yesno(r["INSCRIPCIONES_ABIERTAS"]),
            },
            "platform": clip(val(r["PLATAFORMA"]), 160),
            "language": val(r["IDIOMA"]) or "Español",
            "country": val(r["PAIS_PROGRAMA"]) or val(r["PAIS_INSTITUCION"]) or "Perú",
            "image": None,
            "url": val(r["URL_FINAL"]) or val(r["URL_ORIGEN"]),
            "featured": False,
            "rating": None,
            "reviews_count": None,
            "financing": {
                "installments": installments if installments and installments > 1 else None,
                "installment_amount": num(r["PRECIO_CUOTA"]) if installments and installments > 1 else None,
                "methods": [],
                "notes": "",
            },
            "keywords": [k for k in (val(r["SUBAREA"]), val(r["TIPO_PUBLICADO"])) if k],
            "status": "publicado",
            "completeness": round(float(r["PORCENTAJE_COMPLETITUD"] or 0), 3),
            "updated_at": extracted,
            "is_demo": False,
        }
        courses.append(course)
        inst_courses[inst_name].append(course)

    # Instituciones
    institutions = []
    for inst_name, cs in sorted(inst_courses.items(), key=lambda kv: -len(kv[1])):
        slug, public, short_name, kind, color = INSTITUTIONS[inst_name]
        country = Counter(c["country"] for c in cs).most_common(1)[0][0]
        src = next(r for r in records if r["INSTITUCION"] == inst_name)
        country = val(src["PAIS_INSTITUCION"]) or country
        origin = re.match(r"^(https?://[^/]+)", cs[0]["url"]).group(1)
        institutions.append({
            "id": f"inst-{slug}",
            "slug": slug,
            "name": public,
            "short_name": short_name,
            "type": kind,
            "country": country,
            "city": country,
            "founded": None,
            "brand_color": color,
            "description": f"{public} es una institución de tipo «{kind.lower()}» con sede en {country}. "
                           f"Compara aquí sus programas de tecnología con información obtenida de su sitio web oficial.",
            "website": origin,
            "accreditations": [],
            "logo": None,
            "is_demo": False,
        })

    # Categorías: base existentes + nuevas
    base = json.loads((DATA / "categories.json").read_text())
    ids = {c["id"] for c in base}
    categories = base + [c for c in NEW_CATEGORIES if c["id"] not in ids]

    courses.sort(key=lambda c: c["id"])
    (DATA / "courses.json").write_text(json.dumps(courses, ensure_ascii=False, separators=(",", ":")) + "\n")
    (DATA / "institutions.json").write_text(json.dumps(institutions, ensure_ascii=False, indent=1) + "\n")
    (DATA / "categories.json").write_text(json.dumps(categories, ensure_ascii=False, indent=2) + "\n")

    print(f"Programas importados: {len(courses)} · Instituciones: {len(institutions)} · Categorías: {len(categories)}")
    for k, v in skipped.items():
        print(f"  descartados — {k}: {v}")
    print("  por categoría:", dict(Counter(c["category"] for c in courses).most_common()))
    print("  con precio:", sum(c["price"] is not None for c in courses),
          "· con horas:", sum(c["duration_hours"] is not None for c in courses),
          "· con fecha de inicio:", sum(c["start_date"] is not None for c in courses))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Uso: python3 scripts/import_xlsx.py archivo.xlsx")
    main(sys.argv[1])
