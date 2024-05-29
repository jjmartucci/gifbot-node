/*
 * Utility function to close match text inputs
 */
const getCharFrequency = (str) => {
  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  return freq;
};

const calculateMatchScore = (inputFreq, targetFreq) => {
  let score = 0;
  for (const char in inputFreq) {
    if (targetFreq[char]) {
      score += Math.min(inputFreq[char], targetFreq[char]);
    }
  }
  return score;
};

export const findClosestMatch = (inputString, stringArray) => {
  const inputFreq = getCharFrequency(inputString);
  let bestMatch = null;
  let bestScore = -1;

  for (const targetString of stringArray) {
    const targetFreq = getCharFrequency(targetString);
    const score = calculateMatchScore(inputFreq, targetFreq);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = targetString;
    }
  }

  return bestMatch;
};
