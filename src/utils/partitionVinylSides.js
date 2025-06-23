/**
 * Partitions a list of tracks into sides of a vinyl record.
 * Each side has a maximum duration limit.
 * Ensures that the total number of sides is even by adding an empty side if necessary.
 *
 * @param {Array<Object>} tracks - An array of Spotify track objects. Each object must have a `duration_ms` property.
 * @param {number} sideLimit - The maximum duration of a single side in seconds (default: 22 minutes = 1320 seconds).
 * @returns {Array<Array<Object>>} - An array of sides, where each side is an array of track objects.
 */
export function partitionVinylSides(tracks, sideLimit = 1320) {
  if (!tracks || tracks.length === 0) {
    return [];
  }

  const sides = [];
  let currentSide = [];
  let currentTime = 0; // in seconds

  for (const track of tracks) {
    const durationInSeconds = track.duration_ms / 1000;
    if (currentTime + durationInSeconds <= sideLimit) {
      currentSide.push(track);
      currentTime += durationInSeconds;
    } else {
      sides.push(currentSide);
      currentSide = [track];
      currentTime = durationInSeconds;
    }
  }

  if (currentSide.length > 0) {
    sides.push(currentSide);
  }

  // Ensure an even number of sides by adding an empty side if the count is odd
  if (sides.length > 0 && sides.length % 2 !== 0) {
    sides.push([]);
  }

  return sides;
}
