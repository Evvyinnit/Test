export function getCharacterContentRating(character) {
  if (!character) return 'sfw';
  const rating = character.contentRating ?? character.rating;
  if (rating === 'nsfw') return 'nsfw';
  return 'sfw';
}

export function isCharacterNsfw(character) {
  return getCharacterContentRating(character) === 'nsfw';
}

export function filterNsfw(characters, nsfwEnabled) {
  if (nsfwEnabled) return characters;
  return characters.filter((character) => !isCharacterNsfw(character));
}
