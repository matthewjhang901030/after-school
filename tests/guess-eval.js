/**
 * 30-item evaluation set for 你說我猜 (Section 4.4.3 & M7 DoD).
 * Classic script (file:// compatible, assigns to window.App.data.guessEval).
 * Every item uses a concrete word from data/english-2000-data.js with a natural
 * Taiwanese-university-level English description that avoids the target word.
 * @namespace App.data.guessEval
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.data = App.data || {};

  App.data.guessEval = [
    { word: 'library', description: 'A quiet public building where students study and find shelves of books.' },
    { word: 'spoon', description: 'A small silver utensil with a round bowl used for eating hot soup.' },
    { word: 'apple', description: 'A crisp red or green fruit that grows on trees and tastes sweet.' },
    { word: 'winter', description: 'The coldest season of the year when snow falls and people wear heavy coats.' },
    { word: 'rain', description: 'Drops of water falling down from grey clouds in the sky.' },
    { word: 'doctor', description: 'A trained medical professional who checks sick patients at a clinic.' },
    { word: 'hospital', description: 'A large medical building where injured or sick people receive care.' },
    { word: 'bicycle', description: 'A two-wheeled vehicle that you ride by pushing pedals with your feet.' },
    { word: 'umbrella', description: 'A folding cloth canopy you hold overhead to stay dry in bad weather.' },
    { word: 'coffee', description: 'A dark roasted hot beverage that helps sleepy people wake up in the morning.' },
    { word: 'teacher', description: 'An educator who stands in front of a classroom and explains lessons.' },
    { word: 'kitchen', description: 'The room in a house where people prepare meals and cook dinner.' },
    { word: 'airport', description: 'A busy transportation hub where planes take off and passengers board flights.' },
    { word: 'mountain', description: 'A very high natural peak rising steeply above the surrounding land.' },
    { word: 'guitar', description: 'A wooden musical instrument with six strings that you strum with fingers.' },
    { word: 'camera', description: 'A handheld optical device used for taking photographs and capturing memories.' },
    { word: 'pencil', description: 'A thin wooden writing stick with graphite inside that can be erased easily.' },
    { word: 'banana', description: 'A long curved yellow fruit with soft sweet flesh inside a peel.' },
    { word: 'summer', description: 'The warmest sunny season when students enjoy beach trips and ice cream.' },
    { word: 'bridge', description: 'A strong structure built over a river so cars and people can cross.' },
    { word: 'garden', description: 'An outdoor yard planted with colorful flowers, grass, and green vegetables.' },
    { word: 'elephant', description: 'A giant grey land mammal with huge ears and a long trunk.' },
    { word: 'jacket', description: 'A warm outer garment with sleeves worn over a shirt in cool air.' },
    { word: 'island', description: 'A piece of dry land completely surrounded by ocean water on every side.' },
    { word: 'market', description: 'A lively open space where vendors sell fresh vegetables, meat, and goods.' },
    { word: 'ticket', description: 'A small printed pass you buy to enter a concert or board a train.' },
    { word: 'mirror', description: 'A smooth glass surface on the wall that reflects your face clearly.' },
    { word: 'bottle', description: 'A narrow-necked container made of glass or plastic for holding water.' },
    { word: 'museum', description: 'A quiet cultural hall displaying ancient art, history objects, and science exhibits.' },
    { word: 'window', description: 'A clear glass opening in a wall that lets fresh air and sunlight inside.' },
  ];
})();
