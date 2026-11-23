import { useId } from 'react';
import '../styles/escena-pedido.css';

// Ilustración del estado registrado. Las animaciones son decorativas y no
// calculan porcentajes, tiempos de fabricación ni cambios de estado.
function Impresora({ id, activa }) {
    const pieza = 'M202 234 197 217 203 201 216 190 213 174 224 163 246 163 258 175 254 190 267 203 272 219 265 235 236 244Z';
    return (
        <g className={`cf-printer-machine${activa ? ' cf-printer-running' : ''}`}>
            <defs>
                <clipPath id={id('pieza')} clipPathUnits="userSpaceOnUse"><path d={pieza} /></clipPath>
                <clipPath id={id('capas')} clipPathUnits="userSpaceOnUse"><rect className="cf-printer-layer-mask" x="190" y="163" width="90" height="82" /></clipPath>
            </defs>

            <ellipse cx="241" cy="309" rx="160" ry="19" fill="#02050d" opacity=".55" />
            <path d="m77 285 94-57h232M100 302l93-57h230M134 319l93-57h203M106 264l122 72M148 239l147 86M196 229l164 96M250 229l146 85" fill="none" stroke="#6a6686" strokeWidth=".7" opacity=".16" />

            {/* Estructura y paneles de la impresora. */}
            <path d="M162 43h225v216H162Z" fill={id.url('vitre')} stroke="#4d5369" strokeWidth="1.1" />
            <path d="m330 78 58-35v216l-58 35Z" fill="#121a29" fillOpacity=".72" stroke="#50596d" />
            <path d="m174 57 186 0M174 66h186M174 75h186" stroke="#626c83" strokeOpacity=".13" />
            <path d="M176 48v205M375 48v205" stroke="#0a0e18" strokeWidth="13" />
            <path d="M179 49v202M378 49v202" stroke="#656d80" strokeWidth="1.4" opacity=".6" />
            <path d="m106 79 57-35h224l-57 35Z" fill={id.url('dessus')} stroke="#697185" />
            <path d="m118 76 49-29h202l-46 29" fill="none" stroke="#8a83a0" strokeWidth="1.2" opacity=".65" />

            {/* La marca verde permite percibir el giro de la bobina. */}
            <path d="M70 151v115m-20 0h47" stroke="#222c3c" strokeWidth="8" strokeLinecap="round" />
            <path d="M73 155v103" stroke="#647087" strokeWidth="1.5" />
            <g className="cf-printer-spool">
                <circle cx="70" cy="129" r="33" fill={id.url('roue')} stroke="#77809c" strokeWidth="1.2" />
                <circle cx="70" cy="129" r="24" fill="#30344a" stroke="#c2a3ef" strokeWidth="3" />
                <circle cx="70" cy="129" r="19" fill="none" stroke="#9674c2" strokeWidth="4" />
                <path d="M70 106v15m0 16v15m-23-23h15m16 0h15m-39-16 11 11m10 10 11 11m-32 0 11-11m10-10 11-11" stroke="#ad9ac6" strokeWidth="2" />
                <path d="M70 102v16" stroke={activa ? '#c6ff80' : '#aa94c8'} strokeWidth="5" strokeLinecap="round" />
                <circle cx="70" cy="103" r="3.5" fill={activa ? '#d8ffad' : '#b6a1cf'} />
                <circle cx="70" cy="129" r="8" fill="#0d1321" stroke="#8a829f" strokeWidth="2" />
            </g>
            <path d="M72 96C87 28 293 12 309 74v52" className="cf-printer-filament" fill="none" stroke="#b6f873" strokeWidth="1.6" opacity=".85" />

            {/* El pórtico sube a medida que se revela la pieza. */}
            <path d="m103 279 59-35h225l-57 35Z" fill={id.url('dessus')} stroke="#5e6a7d" />
            <path d="M103 279h227v36H103Z" fill={id.url('socle')} stroke="#606b80" />
            <path d="m330 279 57-35v35l-57 36Z" fill="#171e2e" stroke="#435066" />
            <path d="M111 284h211" stroke={activa ? '#acfb50' : '#8673ad'} strokeWidth="2" opacity=".8" />
            <path d="m149 240 53-30h146l-53 30Z" fill="#171d2b" stroke="#9c91bc" strokeWidth="1.2" />
            <path d="m158 236 48-26m-18 29 49-29m-18 29 49-29m-18 29 49-29m-18 29 49-29M166 229h147m-133-8h147" fill="none" stroke="#66647d" strokeWidth=".8" opacity=".45" />
            <path d="m153 242 143 0 50-28" fill="none" stroke="#aaff50" strokeWidth="1.2" opacity={activa ? '.75' : '.25'} />

            {/* Pieza ilustrativa: su crecimiento no representa un porcentaje real. */}
            <ellipse className={activa ? 'cf-printer-bed-glow' : undefined} cx="235" cy="241" rx="45" ry="8" fill="#a2f04b" opacity={activa ? '.22' : '.05'} />
            <g className="cf-printer-piece" clipPath={id.url('capas')} opacity={activa ? '1' : '.3'}>
                <path d={pieza} fill={id.url('piece')} stroke="#d2ffad" strokeWidth=".8" />
                <path d="m224 163 12 81-34-10m34 10 10-81m-43 38 64 2m-70 14 75 2m-7 16-41-72m-11 11 45 1m-42 15h38" fill="none" stroke="#375a34" strokeWidth="1.1" opacity=".62" />
                <g clipPath={id.url('pieza')}>
                    <path d="M190 168h90m-90 5h90m-90 5h90m-90 5h90m-90 5h90m-90 5h90m-90 5h90m-90 5h90m-90 5h90m-90 5h90m-90 5h90m-90 5h90m-90 5h90m-90 5h90m-90 5h90" stroke="#ddffc9" strokeWidth=".9" opacity=".5" />
                </g>
            </g>
            {activa && <path d="M198 192h74" className="cf-printer-layer-light" stroke="#e4ffba" strokeWidth="2.3" strokeLinecap="round" />}

            <g className="cf-printer-gantry">
                <path d="M309 87c-1 29-44 13-75 43" fill="none" stroke="#adf27a" strokeWidth="1.5" />
                <rect x="109" y="112" width="225" height="15" rx="3" fill={id.url('rail')} stroke="#778195" strokeWidth=".8" />
                <path d="M116 117h212M116 123h212" stroke="#bdc5d3" strokeWidth=".8" opacity=".4" />
                <path d="M117 125h209" stroke="#070d17" strokeWidth="2.2" strokeDasharray="2 2" />
                <g className="cf-printer-head">
                    <path d="M216 128h36l6 12v24l-8 13h-32l-7-13v-24Z" fill={id.url('metal')} stroke="#8e98ae" strokeWidth="1" />
                    <path d="M216 128h36l-5 7h-26Z" fill="#76869b" />
                    <rect x="221" y="133" width="26" height="3" rx="1.5" fill={activa ? '#b4ff57' : '#b9a1e3'} />
                    <circle cx="234" cy="153" r="12" fill="#101724" stroke="#6c788f" strokeWidth="1" />
                    <g className="cf-printer-fan"><path d="m234 143 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#8b9bad" /><path d="M234 143v7" stroke={activa ? '#c5ff8b' : '#a6b2c1'} strokeWidth="2" strokeLinecap="round" /></g>
                    <circle cx="234" cy="153" r="3.5" fill="#b1a1ce" />
                    <path d="M225 178h18l-4 6h-10Z" fill="#b8a573" />
                    <path d="m230 184 4 5 4-5" fill="#e0c788" />
                    {activa && <g className="cf-printer-extrusion"><path d="M234 189v4" stroke="#e0ffb6" strokeWidth="1.8" /><circle cx="234" cy="192" r="3" fill="#dfffaa" /><ellipse cx="234" cy="193" rx="9" ry="2.5" fill="#c4ff71" opacity=".45" /></g>}
                </g>
            </g>

            {/* Montantes del marco y controles. */}
            <path d="M104 80v206M330 80v206" stroke="#0d1421" strokeWidth="13" strokeLinecap="round" />
            <path d="M108 84v197M334 84v197" stroke="#7d889c" strokeWidth="1.7" />
            <path d="M101 87v191M327 87v191" stroke="#45475f" strokeWidth="1.2" />
            <path d="M103 83h230" stroke="#1b2535" strokeWidth="12" strokeLinecap="round" />
            <path d="M109 79h218" stroke="#95a2b7" strokeWidth="1.4" opacity=".75" />
            {[98, 267].map((y) => <g key={y}><circle cx="105" cy={y} r="2.2" fill="#9da6b7" /><circle cx="331" cy={y} r="2.2" fill="#9da6b7" /></g>)}
            <rect x="141" y="293" width="88" height="15" rx="3" fill="#080e18" stroke="#49566c" />
            <path className="cf-printer-screen-trace" d="M148 300h19m5 0h8m5 0h9m5 0h6" stroke={activa ? '#b2f85c' : '#8872ad'} strokeWidth="2" strokeLinecap="round" />
            <circle className="cf-printer-status-light" cx="216" cy="300" r="2.1" fill={activa ? '#b7ff62' : '#9277ba'} />
            <circle cx="284" cy="301" r="7" fill="#171f2e" stroke="#8691a5" />
            <path d="M284 296v3" stroke="#b0ff54" strokeWidth="1.4" />
            <text x="305" y="305" fontSize="8" fontWeight="800" fontFamily="Arial, sans-serif" fill="#d6dfeb">CF</text>
        </g>
    );
}

function Paquete({ id, completo = false }) {
    return <g className="cf-printer-package">
        <ellipse cx="239" cy="281" rx="105" ry="14" fill="#030710" opacity=".4" />
        <path d="m155 142 77-39 97 39-80 45Z" fill={id.url('carton-top')} stroke="#c4b6df" strokeWidth="1" />
        <path d="m155 142 94 45v91l-94-45Z" fill={id.url('carton-front')} stroke="#9a8cb4" />
        <path d="m249 187 80-45v91l-80 45Z" fill="#51466d" stroke="#9c89b5" />
        <path d="m190 124 96 44 16-10-97-42Z" fill="#a8fa53" opacity=".9" />
        <path d="m286 168 16-10v38l-16 9Z" fill="#85c940" />
        <path d="m171 184 46 21v34l-46-21Z" fill="#e4e0ee" opacity=".92" />
        <path d="m178 197 31 14m-31-6 19 9m-19-1 26 12" stroke="#736283" strokeWidth="2.1" />
        <path d="m277 226 25-14m-25 22 16-9" stroke="#c6afd9" strokeWidth="2" opacity=".75" />
        {completo ? <g className="cf-printer-delivered-check"><circle cx="331" cy="129" r="29" fill="#aefd55" stroke="#d4ffa2" strokeWidth="1.2" /><path d="m318 129 9 9 18-20" fill="none" stroke="#22391b" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" /></g>
            : <g><circle cx="341" cy="123" r="26" fill="#22283c" stroke="#b6a0dc" /><path d="M327 132v-18l14 12 14-12v18" fill="none" stroke="#c9b4eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></g>}
    </g>;
}

function Camion({ id }) {
    return <g className="cf-printer-shipping">
        <path d="M63 287h357" stroke="#62657d" strokeWidth="1.2" opacity=".5" />
        <g className="cf-printer-road-marks" stroke="#b1a1cf" strokeWidth="2" strokeLinecap="round" opacity=".65"><path d="M41 298h32m27 0h32m27 0h32m27 0h32m27 0h32m27 0h32m27 0h32m27 0h32" /></g>
        <ellipse cx="243" cy="274" rx="141" ry="12" fill="#030711" opacity=".45" />
        <path d="M82 182v-51h45v51m-22-51v-27h56v43m179 0V96h39v102m0-81h26v81" fill="none" stroke="#5a546e" strokeWidth="1" opacity=".15" />
        <g className="cf-printer-truck-body">
            <path d="m111 152 34-24h159l-34 24Z" fill={id.url('carton-top')} stroke="#9f91bd" />
            <path d="M111 152h159v100H111Z" fill={id.url('carton-front')} stroke="#b3a0cf" />
            <path d="m270 152 34-24v102l-34 22Z" fill="#50476d" stroke="#9c87b7" />
            <path d="M123 164h134v73H123Z" fill="#252638" fillOpacity=".34" stroke="#c0a7de" strokeOpacity=".25" />
            <path d="M132 174h39m-39 7h25" stroke="#c5aedf" strokeWidth="2" opacity=".65" />
            <text x="174" y="214" fontSize="30" fontWeight="800" fontStyle="italic" fontFamily="Arial, sans-serif" fill="#bbfb76">CF</text>
            <path d="M273 178h49l37 42v32h-86Z" fill={id.url('metal')} stroke="#9ea9be" />
            <path d="M285 186h32l24 28h-56Z" fill="#172737" stroke="#768a9c" />
            <path d="m289 191 23 0 15 18" fill="none" stroke="#a6b5c8" strokeWidth="1.2" opacity=".6" />
            <path d="M285 221v22m1-19h13" stroke="#8996a9" strokeWidth="1.4" />
            <rect x="344" y="225" width="12" height="7" rx="2" fill="#dcff9f" />
            <path d="M105 249h257v9H105Z" fill="#141d2c" stroke="#64738b" />
            <path d="M115 245h145" stroke="#b7ff64" strokeWidth="2" />
            <g className="cf-printer-wheel cf-printer-wheel-back"><circle cx="154" cy="257" r="18" fill="#0b101b" stroke="#627088" strokeWidth="2.5" /><circle cx="154" cy="257" r="9" fill="#536078" /><path d="M154 248v18m-9-9h18" stroke="#a1acc0" strokeWidth="1.6" /><circle cx="154" cy="257" r="3" fill="#b4fc65" /></g>
            <g className="cf-printer-wheel cf-printer-wheel-front"><circle cx="321" cy="257" r="18" fill="#0b101b" stroke="#627088" strokeWidth="2.5" /><circle cx="321" cy="257" r="9" fill="#536078" /><path d="M321 248v18m-9-9h18" stroke="#a1acc0" strokeWidth="1.6" /><circle cx="321" cy="257" r="3" fill="#b4fc65" /></g>
        </g>
        <path d="M73 209h21m-28 13h20m-8 13h16" stroke="#a9ec64" strokeWidth="1.5" strokeLinecap="round" opacity=".5" />
    </g>;
}

export default function EscenaPedido({ estado, esMetro = false, movimientoManual = false }) {
    const prefijo = `cf-printer-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const id = (nombre) => `${prefijo}-${nombre}`;
    id.url = (nombre) => `url(#${id(nombre)})`;
    const activa = estado === 'en_produccion';
    const enviado = estado === 'enviado';
    const entregado = estado === 'entregado';

    return (
        <svg className={`cf-printer-scene${enviado && !esMetro ? ' cf-printer-delivery-active' : ''}`} data-motion-enabled={movimientoManual} viewBox="0 0 480 360" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id={id('fondo')} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1b2135" /><stop offset="1" stopColor="#0b1120" /></linearGradient>
                <radialGradient id={id('halo')}><stop stopColor="#9c62d8" stopOpacity=".25" /><stop offset="1" stopColor="#8e53c6" stopOpacity="0" /></radialGradient>
                <radialGradient id={id('halo-verde')}><stop stopColor="#b5ff5c" stopOpacity=".11" /><stop offset="1" stopColor="#b5ff5c" stopOpacity="0" /></radialGradient>
                <linearGradient id={id('metal')} x1="0" y1="0" x2="1" y2=".7"><stop stopColor="#79869d" /><stop offset=".2" stopColor="#46546a" /><stop offset=".55" stopColor="#253246" /><stop offset="1" stopColor="#556178" /></linearGradient>
                <linearGradient id={id('rail')} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#8a97ac" /><stop offset=".35" stopColor="#3c4b61" /><stop offset="1" stopColor="#172233" /></linearGradient>
                <linearGradient id={id('dessus')} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#626d83" /><stop offset=".4" stopColor="#343e53" /><stop offset="1" stopColor="#222b3e" /></linearGradient>
                <linearGradient id={id('socle')} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#3d485d" /><stop offset="1" stopColor="#192334" /></linearGradient>
                <linearGradient id={id('vitre')} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#69617e" stopOpacity=".14" /><stop offset="1" stopColor="#1b2b32" stopOpacity=".45" /></linearGradient>
                <linearGradient id={id('roue')} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#5e5872" /><stop offset="1" stopColor="#172131" /></linearGradient>
                <linearGradient id={id('piece')} x1="0" y1="0" x2="1" y2=".5"><stop stopColor="#9cda55" /><stop offset=".45" stopColor="#d1ff9b" /><stop offset="1" stopColor="#72ac40" /></linearGradient>
                <linearGradient id={id('carton-top')} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#aa96c5" /><stop offset="1" stopColor="#77618e" /></linearGradient>
                <linearGradient id={id('carton-front')} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#837098" /><stop offset="1" stopColor="#625172" /></linearGradient>
            </defs>
            <rect width="480" height="360" rx="24" fill={id.url('fondo')} />
            <ellipse cx="331" cy="99" rx="205" ry="142" fill={id.url('halo')} />
            <ellipse cx="141" cy="278" rx="194" ry="107" fill={id.url('halo-verde')} />
            <path d="M23 53V26h27M430 26h27v27M23 307v27h27M430 334h27v-27" fill="none" stroke="#756a94" strokeWidth="1" opacity=".38" />
            <path d="M25 26h24M433 334h23" stroke="#b4f963" strokeWidth="1.6" opacity=".75" />
            {entregado ? <Paquete id={id} completo /> : enviado ? (esMetro ? <Paquete id={id} /> : <Camion id={id} />) : <Impresora id={id} activa={activa} />}
        </svg>
    );
}
