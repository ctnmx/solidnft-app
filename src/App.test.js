import { render, screen } from '@testing-library/react';
import App from './App';
import { priceFor, sizeFor, sizingRange } from './print';

test("affiche le titre et le CTA d'accueil", () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /dernier print/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /je simule un print/i })).toBeInTheDocument();
});

test('la plage de taille respecte les bornes produit', () => {
  // Carré : 15×15 cm mini, 120×120 cm maxi (petit côté plafonné à 120).
  expect(sizingRange(1000, 1000)).toMatchObject({ min: 15, max: 120 });
  // Panoramique 2:1 : jusqu'à 240×120 cm.
  expect(sizingRange(4000, 2000)).toMatchObject({ min: 30, max: 240 });
  // 4:3 : le petit côté plafonne à 120 cm, soit 160×120 cm.
  expect(sizingRange(4000, 3000)).toMatchObject({ min: 20, max: 160 });
});

test('les dimensions restent entières et conservent le ratio', () => {
  const size = sizeFor(80, 4000, 3000);
  expect(size).toMatchObject({ widthCm: 80, heightCm: 60 });
  expect(Number.isInteger(size.widthCm)).toBe(true);
  expect(Number.isInteger(size.heightCm)).toBe(true);

  // Image portrait : le grand côté est la hauteur.
  expect(sizeFor(80, 3000, 4000)).toMatchObject({ widthCm: 60, heightCm: 80 });
});

test('le prix suit la surface en m² × 754,80 €', () => {
  expect(priceFor(100, 100)).toBeCloseTo(754.8, 5); // 1 m²
  expect(priceFor(80, 60)).toBeCloseTo(0.48 * 754.8, 5);
});
