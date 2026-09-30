import { normalizeReel, classify, taskFromReel } from './core.js';
const entries = [
  ['Creamy one-pot pasta', 'the.weeknight.kitchen', 'Creamy one-pot tomato pasta.\nAdd pasta, cherry tomatoes, garlic and vegetable broth to a pot.\nSimmer until the pasta is tender.\nStir in cream and fresh basil.', 'Food'],
  ['A little less desk stiffness', 'move.with.maya', 'A 5-minute desk mobility routine.\nStretch your hip flexors for 30 seconds on each side.\nDo 10 slow shoulder circles.\nRepeat the routine after your lunch break.', 'Fitness'],
  ['Better photos with your phone', 'framebyframe', 'Phone photography composition tutorial.\nTurn on the grid in your camera settings.\nPractice framing a subject on the left or right third.\nTake three photos of the same subject from different angles.', 'Learn'],
  ['Give your Sunday a reset', 'small.space.studio', 'Sunday room reset.\nClear your desk and put away loose items.\nSort the laundry into lights and darks.\nWater your plants if the soil is dry.', 'Home'],
  ['A weekend in Montréal', 'weekend.wanderer', 'A walking trip through Montreal.\nVisit the Jean-Talon Market for breakfast.\nWalk through the Old Port.\nPlan an afternoon at the museum.', 'Travel'],
  ['A budget you will actually use', 'everyday.pennies', 'A simple weekly budget.\nTrack your spending for seven days.\nSort expenses into needs, wants and savings.\nSet a realistic limit for eating out.', 'Money'],
  ['Breakfast, sorted', 'the.weeknight.kitchen', 'Peanut butter overnight oats recipe.\nMix rolled oats, milk and a spoon of peanut butter in a jar.\nPut the jar in the fridge overnight.\nAdd sliced banana before serving.', 'Food'],
  ['Make time for guitar', 'tiny.practice', 'Guitar practice for absolute beginners.\nLearn the Em and G chords.\nPractice switching between them slowly.\nSpend ten minutes practising every day.', 'Learn'],
  ['When the group chat gets quiet', 'just.for.the.bit', 'POV: the group chat after everyone says we should hang out. Relatable meme. lmao.', 'Other'],
  ['Brainrot compilation', 'scroll.loop', 'Skibidi brainrot memes compilation. Just funny clips and lip sync.', 'Other'],
  ['Saved without a caption', 'a.saved.creator', '', 'Other'],
  ['An idea for later', 'inspiration.daily', 'Sometimes you just need a change of scenery. Save this beautiful moment for later.', 'Other'],
];
export function exampleState() {
  const reels = entries.map(([title,creator,caption],i) => {
    const r = normalizeReel({ url: `https://www.instagram.com/reel/example${i+1}/`, title, creator, caption, demo: true });
    const analysis = classify(r); return { ...r, status: analysis.status, analysis };
  });
  return { reels, tasks: reels.slice(0,4).map(taskFromReel) };
}
