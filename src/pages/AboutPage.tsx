import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Icon, type IconName } from '../components/ui/Icon';
import { useSeo } from '../hooks/useSeo';

const PILLARS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'compare', title: 'Comparar', text: 'Normalizamos precio, duración, modalidad, nivel y certificación para que compares opciones de distintas instituciones con el mismo criterio.' },
  { icon: 'search', title: 'Descubrir', text: 'Centralizamos lo que hoy está disperso entre webs, PDFs, redes sociales y asesores comerciales.' },
  { icon: 'target', title: 'Decidir', text: 'Te damos la información para elegir según tus objetivos. Tú decides cuándo y con quién hablar.' }
];

const PRINCIPLES = [
  ['Primero ayudar, después vender', 'Obtienes valor antes de entregar tus datos: explorar y comparar no requiere registro.'],
  ['Transparencia', 'Mostramos precios, duración y modalidad cuando están disponibles. Los listings patrocinados se identifican como “Destacado”.'],
  ['Información comparable', 'Mismos campos para todos los programas, sin importar cómo lo comunique cada institución.'],
  ['Conversión sin fricción', 'Solo pedimos tus datos cuando quieres que una institución te contacte, y solo se los enviamos a ella.']
];

export default function AboutPage() {
  useSeo({ title: 'Nosotros', description: 'Elegir dónde aprender tecnología no debería ser complicado. Groulevel hace más transparente y eficiente la decisión de formación profesional.', path: '/nosotros' });
  return (
    <>
      <section className="border-b border-line">
        <div className="container-page pb-16 pt-8 sm:pb-24">
          <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Nosotros' }]} />
          <span className="eyebrow mt-10">Nosotros</span>
          <h1 className="mt-5 max-w-4xl text-4xl leading-[1.04] text-white sm:text-6xl">
            Elegir dónde aprender tecnología <span className="grad-text">no debería ser complicado.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-gray">
            Groulevel nace para hacer más transparente y eficiente la decisión de formación profesional. Reunimos cursos, bootcamps, diplomados y maestrías en tecnología, datos e inteligencia artificial, y los presentamos con información homogénea para que compares en minutos lo que antes tomaba semanas.
          </p>
        </div>
      </section>

      <section className="container-page py-16" aria-label="Pilares">
        <ol className="grid gap-4 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <li key={p.title} className="card p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong text-cyan"><Icon name={p.icon} size={20} /></span>
                <span className="font-mono text-sm text-dim">0{i + 1}</span>
              </div>
              <h2 className="mt-5 text-2xl text-white">{p.title}</h2>
              <p className="mt-2 text-gray">{p.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-page py-8" aria-labelledby="princ">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <span className="label-mono">Cómo trabajamos</span>
            <h2 id="princ" className="mt-3 text-3xl text-white sm:text-4xl">Independientes y del lado de quien aprende.</h2>
            <p className="mt-4 text-gray">Las instituciones pueden destacar programas o pagar por solicitudes recibidas, pero eso nunca cambia la información que mostramos ni el orden por relevancia sin identificarlo.</p>
          </div>
          <dl className="divide-y divide-line border-y border-line">
            {PRINCIPLES.map(([t, d]) => (
              <div key={t} className="grid gap-1 py-5 sm:grid-cols-[220px_1fr] sm:gap-6">
                <dt className="font-medium text-white">{t}</dt>
                <dd className="text-gray">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="container-page pt-16 text-center">
        <h2 className="text-3xl text-white">Empieza a comparar.</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/programas" className="btn btn-primary btn-lg">Explorar programas</Link>
          <Link to="/instituciones/partners" className="btn btn-ghost btn-lg">Soy una institución</Link>
        </div>
      </section>
    </>
  );
}
