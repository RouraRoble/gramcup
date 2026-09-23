import type { APIRoute, GetStaticPaths } from 'astro';
import { renderOg } from '../../lib/og';
import { ingredients } from '../../lib/ingredients';

export const getStaticPaths: GetStaticPaths = () => ingredients.map((i) => ({ params: { ingredient: i.slug } }));

export const GET: APIRoute = async ({ params }) => {
  const ingredient = ingredients.find((i) => i.slug === params.ingredient);
  if (!ingredient) return new Response('Not found', { status: 404 });
  const png = await renderOg({
    title: `${ingredient.name}: ${ingredient.gramsPerCup} g per cup`,
    subtitle: `1 tbsp = ${ingredient.gramsPerTbsp} g · 1 tsp = ${ingredient.gramsPerTsp} g`,
    eyebrow: 'GramCup — grams to cups',
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
