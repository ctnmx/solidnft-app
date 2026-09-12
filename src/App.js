import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_LABEL,
  ACCEPTED_TYPES,
  analyseImageFile,
  isAcceptedFile,
} from './imageMeta';
import {
  MAX_LONG_CM,
  MAX_SHORT_CM,
  MIN_SIDE_CM,
  PRICE_PER_M2,
  defaultLongSide,
  formatBytes,
  formatNumber,
  formatPixels,
  formatPrice,
  formatRatio,
  areaM2,
  printDpi,
  priceFor,
  sizeFor,
  sizingRange,
} from './print';

const ANALYSIS_MS = 2400;
const SPINNER = ['|', '/', '-', '\\'];

const ANALYSIS_STEPS = [
  'Lecture du fichier',
  'Décodage des pixels',
  'Extraction du ratio',
  'Recherche du DPI',
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* Fenêtres rétro                                                      */
/* ------------------------------------------------------------------ */

function Window({ title, children, footer }) {
  return (
    <div className="window" role="dialog" aria-modal="true" aria-label={title}>
      <div className="window__bar">
        <span className="window__title">{title}</span>
        <span className="window__buttons" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
      <div className="window__body">{children}</div>
      {footer ? <div className="window__footer">{footer}</div> : null}
    </div>
  );
}

function Overlay({ children }) {
  return <div className="overlay">{children}</div>;
}

function AnalysingWindow() {
  const [percent, setPercent] = useState(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const progress = setInterval(() => {
      const ratio = Math.min(1, (Date.now() - started) / ANALYSIS_MS);
      setPercent(Math.round(ratio * 100));
    }, 60);
    const spin = setInterval(() => setFrame((f) => f + 1), 110);

    return () => {
      clearInterval(progress);
      clearInterval(spin);
    };
  }, []);

  const done = Math.min(
    ANALYSIS_STEPS.length,
    Math.floor((percent / 100) * (ANALYSIS_STEPS.length + 0.4))
  );

  return (
    <Overlay>
      <Window title="ANALYSE.EXE">
        <p className="analysis__headline">
          <span className="analysis__spinner" aria-hidden="true">
            {SPINNER[frame % SPINNER.length]}
          </span>
          Analyse de l&apos;image en cours
          <span className="analysis__dots" aria-hidden="true">
            ...
          </span>
        </p>

        <ul className="analysis__steps">
          {ANALYSIS_STEPS.map((step, index) => (
            <li
              key={step}
              className={
                index < done
                  ? 'analysis__step analysis__step--done'
                  : index === done
                  ? 'analysis__step analysis__step--active'
                  : 'analysis__step'
              }
            >
              <span className="analysis__marker" aria-hidden="true">
                {index < done ? '[x]' : index === done ? '[>]' : '[ ]'}
              </span>
              {step}
            </li>
          ))}
        </ul>

        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="progress__fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="analysis__percent">{percent} %</p>
      </Window>
    </Overlay>
  );
}

function ErrorWindow({ message, onClose }) {
  return (
    <Overlay>
      <Window
        title="ERREUR"
        footer={
          <button type="button" className="btn" onClick={onClose}>
            OK
          </button>
        }
      >
        <p className="dialog__text">{message}</p>
      </Window>
    </Overlay>
  );
}

function OrderWindow({ image, size, price, onClose }) {
  return (
    <Overlay>
      <Window
        title="COMMANDE"
        footer={
          <button type="button" className="btn" onClick={onClose}>
            Fermer
          </button>
        }
      >
        <p className="dialog__text">Récapitulatif de votre tirage.</p>
        <dl className="specs specs--dialog">
          <div className="specs__row">
            <dt>Produit</dt>
            <dd>Tirage en aluminium</dd>
          </div>
          <div className="specs__row">
            <dt>Fichier</dt>
            <dd className="specs__ellipsis">{image.name}</dd>
          </div>
          <div className="specs__row">
            <dt>Format</dt>
            <dd>
              {size.widthCm} × {size.heightCm} cm
            </dd>
          </div>
          <div className="specs__row">
            <dt>Surface</dt>
            <dd>{formatNumber(areaM2(size.widthCm, size.heightCm), 3)} m²</dd>
          </div>
          <div className="specs__row">
            <dt>Total</dt>
            <dd>{formatPrice(price)}</dd>
          </div>
        </dl>
        <p className="dialog__note">
          Le paiement n&apos;est pas encore branché : cette étape reste à
          connecter au tunnel de commande.
        </p>
      </Window>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ */
/* Application                                                         */
/* ------------------------------------------------------------------ */

export default function App() {
  const [view, setView] = useState('home'); // home | analysing | result
  const [image, setImage] = useState(null);
  const [longSide, setLongSide] = useState(MIN_SIDE_CM);
  const [error, setError] = useState(null);
  const [ordering, setOrdering] = useState(false);

  const inputRef = useRef(null);
  const imageUrlRef = useRef(null);

  useEffect(
    () => () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    },
    []
  );

  const openPicker = useCallback(() => {
    if (inputRef.current) inputRef.current.click();
  }, []);

  const handleFile = useCallback(async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // permet de re-sélectionner le même fichier
    if (!file) return;

    if (!isAcceptedFile(file)) {
      setError(`Format non pris en charge. Formats acceptés : ${ACCEPTED_LABEL}.`);
      return;
    }

    setView('analysing');

    try {
      const [analysed] = await Promise.all([
        analyseImageFile(file),
        wait(ANALYSIS_MS),
      ]);

      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = analysed.url;

      setImage(analysed);
      setLongSide(defaultLongSide(sizingRange(analysed.width, analysed.height)));
      setView('result');
    } catch (err) {
      setView(imageUrlRef.current ? 'result' : 'home');
      setError(err.message || "L'analyse de l'image a échoué.");
    }
  }, []);

  const range = useMemo(
    () => (image ? sizingRange(image.width, image.height) : null),
    [image]
  );

  const size = useMemo(
    () => (image ? sizeFor(longSide, image.width, image.height) : null),
    [image, longSide]
  );

  const price = size ? priceFor(size.widthCm, size.heightCm) : 0;

  const accept = [...ACCEPTED_TYPES, ...ACCEPTED_EXTENSIONS].join(',');

  return (
    <div className="app">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFile}
        className="file-input"
        tabIndex={-1}
        aria-hidden="true"
      />

      {view === 'result' && image && size && range ? (
        <ResultView
          image={image}
          range={range}
          size={size}
          price={price}
          longSide={longSide}
          onLongSideChange={setLongSide}
          onReplace={openPicker}
          onOrder={() => setOrdering(true)}
        />
      ) : (
        <HomeView onStart={openPicker} />
      )}

      {view === 'analysing' ? <AnalysingWindow /> : null}

      {error ? <ErrorWindow message={error} onClose={() => setError(null)} /> : null}

      {ordering && image && size ? (
        <OrderWindow
          image={image}
          size={size}
          price={price}
          onClose={() => setOrdering(false)}
        />
      ) : null}
    </div>
  );
}

function HomeView({ onStart }) {
  return (
    <main className="home">
      <h1 className="home__title">Dernier print</h1>
      <button type="button" className="btn btn--lg" onClick={onStart}>
        Je simule un print
      </button>
      <p className="home__note">{ACCEPTED_LABEL}</p>
    </main>
  );
}

function ResultView({
  image,
  range,
  size,
  price,
  longSide,
  onLongSideChange,
  onReplace,
  onOrder,
}) {
  const effectiveDpi = printDpi(
    image.width,
    image.height,
    size.widthCm,
    size.heightCm
  );

  return (
    <main className="result">
      <section className="result__preview">
        <div className="frame">
          <img
            src={image.url}
            alt={image.name}
            className="frame__image"
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
          />
        </div>
        <p className="frame__caption">
          <span className="frame__name">{image.name}</span>
          <span className="frame__size">{formatBytes(image.bytes)}</span>
        </p>
      </section>

      <section className="result__config">
        <header className="config__header">
          <h1 className="config__title">Tirage en aluminium</h1>
          <button type="button" className="link" onClick={onReplace}>
            Changer d&apos;image
          </button>
        </header>

        <dl className="specs">
          <div className="specs__row">
            <dt>Ratio</dt>
            <dd>{formatRatio(image.width, image.height)}</dd>
          </div>
          <div className="specs__row">
            <dt>Pixels</dt>
            <dd>
              {formatPixels(image.width)} × {formatPixels(image.height)} —{' '}
              {formatNumber(image.pixels / 1e6, 1)} Mpx
            </dd>
          </div>
          <div className="specs__row">
            <dt>DPI fichier</dt>
            <dd>
              {image.dpi}
              {image.dpiEmbedded ? '' : ' (par défaut)'}
            </dd>
          </div>
        </dl>

        <div className="sizer">
          <div className="sizer__head">
            <span className="label">Format</span>
            <output className="sizer__value" htmlFor="size-slider">
              {size.widthCm} × {size.heightCm} cm
            </output>
          </div>

          <input
            id="size-slider"
            type="range"
            className="slider"
            min={range.min}
            max={range.max}
            step={1}
            value={longSide}
            onChange={(event) => onLongSideChange(Number(event.target.value))}
            aria-label="Taille du tirage, grand côté en centimètres"
          />

          <div className="sizer__scale">
            <span>{MIN_SIDE_CM}×{MIN_SIDE_CM} cm</span>
            <span>pas de 1 cm</span>
            <span>{MAX_SHORT_CM}×{MAX_LONG_CM} cm</span>
          </div>

          <p className="sizer__hint">
            Ratio d&apos;origine conservé — {effectiveDpi} DPI à ce format
            {range.outOfRange
              ? ' · ratio hors plage standard, format ajusté au plus proche'
              : ''}
          </p>
        </div>

        <div className="checkout">
          <div className="checkout__price">
            <span className="label">
              {formatNumber(areaM2(size.widthCm, size.heightCm), 3)} m² ×{' '}
              {formatNumber(PRICE_PER_M2, 2)} €
            </span>
            <strong className="checkout__amount">{formatPrice(price)}</strong>
          </div>
          <button type="button" className="btn btn--lg" onClick={onOrder}>
            Commander
          </button>
        </div>
      </section>
    </main>
  );
}
