/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MusicNode, MusicLink } from './types';
import { refineColor } from './engine/palette';

interface CompactArtist {
  id: string;
  name: string;
  chineseName?: string;
  region: string;
  genre: string;
  color: string;
  desc: string;
  searchArtist?: string; // iTunes search alias (e.g. 'Agust D' for SUGA)
  itunesArtists?: string[]; // accepted iTunes artist credits
  songs: [string, string?, number?, string?, string?][]; // [name, chineseName, bpm, key, mood]
}

const COMPACT_ARTISTS: CompactArtist[] = [
  {
    id: 'bts',
    name: 'BTS',
    chineseName: '防弹少年团',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#A855F7',
    desc: 'Global pop icons leading the Korean Wave with powerful choreography and social messages.',
    songs: [
      ['Dynamite', 'Dynamite', 114, 'E Major', 'Cheerful'],
      ['Butter', 'Butter', 110, 'Ab Major', 'Cheerful'],
      ['Boy With Luv', '작은 것들을 위한 시', 120, 'B Minor', 'Sweet'],
      ['Spring Day', '봄날', 77, 'Eb Major', 'Nostalgic'],
      ['Fake Love', 'Fake Love', 78, 'D Minor', 'Dramatic'],
      ['DNA', 'DNA', 130, 'C# Minor', 'Energetic'],
      ['Blood Sweat & Tears', '피 땀 눈물', 93, 'C Minor', 'Sensual'],
      ['Idol', 'Idol', 126, 'C# Minor', 'Energetic'],
      ['Life Goes On', 'Life Goes On', 82, 'C Major', 'Hopeful'],
      ['Mic Drop', 'Mic Drop', 170, 'F Minor', 'Aggressive'],
      ['On', 'ON', 106, 'A Minor', 'Anthemic'],
      ['Run BTS', '달려라 방탄', 145, 'E Minor', 'Aggressive'],
      ['Fire', '불타오르네', 124, 'D Minor', 'Energetic'],
      ['Permission to Dance', 'Permission to Dance', 125, 'A Major', 'Cheerful'],
      ['The Truth Untold', '전하지 못한 진심', 74, 'F# Minor', 'Sad'],
      ['I Need U', 'I Need U', 120, 'F Minor', 'Emotional'],
      ['Dope', '쩔어', 128, 'B Minor', 'Energetic'],
      ['Save Me', 'Save Me', 140, 'Eb Major', 'Hopeful'],
      ['Black Swan', 'Black Swan', 147, 'D Minor', 'Artistic'],
      ['Yet To Come', 'Yet To Come', 86, 'Db Major', 'Warm']
    ]
  },
  {
    id: 'blackpink',
    name: 'BLACKPINK',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#F472B6',
    desc: 'The biggest girl group in the world, known for their trap-pop bangers and high-fashion concept.',
    songs: [
      ['DDU-DU DDU-DU', '뚜두뚜두', 140, 'E Minor', 'Bold'],
      ['Kill This Love', 'Kill This Love', 132, 'D Minor', 'Bold'],
      ['How You Like That', 'How You Like That', 130, 'B Minor', 'Bold'],
      ['Pink Venom', 'Pink Venom', 180, 'C Minor', 'Aggressive'],
      ['As If It\'s Your Last', '마지막처럼', 125, 'Ab Major', 'Cheerful'],
      ['Boombayah', '붐바야', 126, 'F Minor', 'Energetic'],
      ['Playing With Fire', '불장난', 97, 'E Minor', 'Fiery'],
      ['Lovesick Girls', 'Lovesick Girls', 120, 'Gb Major', 'Anthemic'],
      ['Whistle', '휘파람', 103, 'A Minor', 'Seductive'],
      ['Shut Down', 'Shut Down', 110, 'D Minor', 'Bold'],
      ['Forever Young', 'Forever Young', 115, 'B Minor', 'Cheerful'],
      ['Ice Cream', 'Ice Cream', 80, 'E Major', 'Sweet'],
      ['Pretty Savage', 'Pretty Savage', 150, 'G Minor', 'Sassy'],
      ['Stay', 'Stay', 88, 'C Major', 'Warm'],
      ['Don\'t Know What To Do', 'Don\'t Know What To Do', 120, 'E Major', 'Emotional'],
      ['Typa Girl', 'Typa Girl', 132, 'F# Minor', 'Sassy'],
      ['Tally', 'Tally', 130, 'C Major', 'Empowering'],
      ['Really', 'Really', 112, 'D Major', 'Sweet'],
      ['Kick It', 'Kick It', 95, 'F Minor', 'Bold'],
      ['Hope Not', '아니길', 78, 'A Major', 'Sad']
    ]
  },
  {
    id: 'twice',
    name: 'TWICE',
    chineseName: '兔瓦斯',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#FF5E97',
    desc: 'Known for their catchy hooks, vibrant concepts, and sweet-toned vocal lines.',
    songs: [
      ['Cheer Up', 'Cheer Up', 125, 'E Major', 'Cheerful'],
      ['TT', 'TT', 130, 'Bb Major', 'Playful'],
      ['Fancy', 'Fancy', 114, 'G Minor', 'Cheerful'],
      ['Feel Special', 'Feel Special', 128, 'Db Major', 'Hopeful'],
      ['What is Love?', 'What is Love?', 120, 'Ab Major', 'Sweet'],
      ['Likey', 'Likey', 128, 'B Major', 'Cheerful'],
      ['I Can\'t Stop Me', 'I Can\'t Stop Me', 150, 'A Minor', 'Energetic'],
      ['Talk that Talk', 'Talk that Talk', 122, 'C# Minor', 'Cheerful'],
      ['Alcohol-Free', 'Alcohol-Free', 97, 'Ab Major', 'Chill'],
      ['Yes or Yes', 'Yes or Yes', 138, 'E Major', 'Energetic'],
      ['Dance the Night Away', 'Dance the Night Away', 122, 'B Major', 'Cheerful'],
      ['The Feels', 'The Feels', 120, 'B Minor', 'Cheerful'],
      ['More & More', 'More & More', 110, 'C Minor', 'Energetic'],
      ['Knock Knock', 'Knock Knock', 122, 'Eb Major', 'Cheerful'],
      ['Heart Shaker', 'Heart Shaker', 128, 'B Major', 'Sweet'],
      ['Signal', 'Signal', 126, 'E Minor', 'Zany'],
      ['One Spark', 'One Spark', 132, 'G Major', 'Emotional'],
      ['Set Me Free', 'Set Me Free', 120, 'D Minor', 'Empowering'],
      ['Scientist', 'Scientist', 113, 'Bb Major', 'Playful'],
      ['Cry For Me', 'Cry For Me', 145, 'E Minor', 'Dramatic']
    ]
  },
  {
    id: 'straykids',
    name: 'Stray Kids',
    chineseName: '迷失的孩子',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#EF4444',
    desc: 'Self-producing powerhouse group famous for their intense electronic-trap "noise" music.',
    songs: [
      ['God\'s Menu', '神메뉴', 157, 'D Minor', 'Aggressive'],
      ['S-Class', '특', 125, 'C# Minor', 'Energetic'],
      ['Maniac', 'Maniac', 120, 'E Minor', 'Bold'],
      ['Thunderous', '소리꾼', 130, 'D Minor', 'Aggressive'],
      ['Case 143', 'Case 143', 100, 'E Minor', 'Zany'],
      ['LALALALA', '락', 128, 'C# Minor', 'Aggressive'],
      ['Back Door', 'Back Door', 109, 'G Minor', 'Energetic'],
      ['Chk Chk Boom', 'Chk Chk Boom', 108, 'E Minor', 'Bold'],
      ['Miroh', 'Miroh', 125, 'G Minor', 'Anthemic'],
      ['Hellevator', 'Hellevator', 156, 'F Minor', 'Dramatic'],
      ['Megaverse', 'Megaverse', 145, 'C Minor', 'Aggressive'],
      ['Topline', 'Topline', 92, 'F Major', 'Bold'],
      ['Social Path', 'Social Path', 132, 'G Major', 'Anthemic'],
      ['Venom', '거미줄', 110, 'C Minor', 'Dark'],
      ['Double Knot', 'Double Knot', 120, 'D Minor', 'Aggressive'],
      ['Domino', 'Domino', 128, 'E Minor', 'Energetic'],
      ['Cheese', 'Cheese', 115, 'A Minor', 'Zany'],
      ['Red Lights', '강박', 104, 'C Minor', 'Sensual'],
      ['Charmer', 'Charmer', 122, 'F# Minor', 'Sassy'],
      ['Side Effects', '부작용', 140, 'G Minor', 'Intense']
    ]
  },
  {
    id: 'ive',
    name: 'IVE',
    chineseName: '艾夫',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#34D399',
    desc: 'Leading 4th gen girl group with elegant, high-teen, narcissistic chic pop anthems.',
    songs: [
      ['Love Dive', 'Love Dive', 118, 'C# Minor', 'Sensual'],
      ['Eleven', 'Eleven', 120, 'E Minor', 'Mysterious'],
      ['After LIKE', 'After LIKE', 125, 'A Major', 'Cheerful'],
      ['I AM', 'I AM', 128, 'Ab Major', 'Anthemic'],
      ['Baddie', 'Baddie', 98, 'F# Minor', 'Chic'],
      ['Kitsch', 'Kitsch', 120, 'A Minor', 'Sassy'],
      ['Accendio', 'Accendio', 124, 'D Minor', 'Mysterious'],
      ['HEYA', 'HEYA', 122, 'C Minor', 'Anthemic'],
      ['Off The Record', 'Off The Record', 108, 'G Major', 'Sweet'],
      ['Either Way', 'Either Way', 76, 'C Major', 'Sad'],
      ['Royal', 'Royal', 124, 'B Minor', 'Empowering'],
      ['Blue Heart', 'Blue Heart', 114, 'D Minor', 'Chic'],
      ['Holy Moly', 'Holy Moly', 122, 'E Minor', 'Zany'],
      ['Mine', 'Mine', 110, 'A Major', 'Sweet'],
      ['Take It', 'Take It', 124, 'F# Minor', 'Sassy'],
      ['My Satisfaction', 'My Satisfaction', 115, 'C Minor', 'Dark'],
      ['Lips', 'Lips', 105, 'F Major', 'Sweet'],
      ['Cherish', 'Cherish', 112, 'Bb Major', 'Playful'],
      ['Wave', 'Wave', 118, 'D Major', 'Cheerful'],
      ['OTT', 'OTT', 102, 'Eb Major', 'Sweet']
    ]
  },
  {
    id: 'lesserafim',
    name: 'LE SSERAFIM',
    chineseName: '炽天使',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#60A5FA',
    desc: 'Fearless and powerful group with athletic, club-friendly disco-house and trap rhythms.',
    songs: [
      ['Fearless', 'Fearless', 104, 'G Minor', 'Cool'],
      ['Antifragile', 'Antifragile', 105, 'D Minor', 'Bold'],
      ['Unforgiven', 'Unforgiven', 122, 'E Minor', 'Bold'],
      ['Eve, Psyche & The Bluebeard\'s wife', '이브, 프시케 그리고 푸른 수염의 아내', 128, 'B Minor', 'Futuristic'],
      ['Perfect Night', 'Perfect Night', 120, 'C Major', 'Chill'],
      ['Easy', 'Easy', 82, 'A Minor', 'Chill'],
      ['Smart', 'Smart', 113, 'G Minor', 'Latin'],
      ['Crazy', 'Crazy', 130, 'E Minor', 'Futuristic'],
      ['Sour Grapes', 'Sour Grapes', 84, 'A Major', 'Sweet'],
      ['Blue Flame', 'Blue Flame', 120, 'C# Minor', 'Groovy'],
      ['No Celestial', 'No Celestial', 145, 'E Major', 'Anthemic'],
      ['Impurities', 'Impurities', 92, 'F Minor', 'Sensual'],
      ['Fire in the belly', 'Fire in the belly', 124, 'A Minor', 'Latin'],
      ['Swan Song', 'Swan Song', 86, 'Db Major', 'Warm'],
      ['Pierrot', 'Pierrot', 118, 'C Minor', 'Energetic'],
      ['Flash Forward', 'Flash Forward', 112, 'Bb Major', 'Sweet'],
      ['1-800-hot-n-fun', '1-800-hot-n-fun', 115, 'B Minor', 'Sassy'],
      ['We got so much', 'We got so much', 122, 'C Major', 'Hopeful'],
      ['Good Bones', 'Good Bones', 150, 'E Minor', 'Defiant']
    ]
  },
  {
    id: 'iu',
    name: 'IU',
    chineseName: '李知恩',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#3B82F6',
    desc: 'South Korea\'s ultimate singer-songwriter and national sweetheart.',
    songs: [
      ['Palette', 'Palette', 102, 'A Major', 'Chill'],
      ['Good Day', 'Good Day', 128, 'Ab Major', 'Energetic'],
      ['Through the Night', '夜信', 76, 'C Major', 'Nostalgic'],
      ['Blueming', 'Blueming', 116, 'G Major', 'Cheerful'],
      ['Love Wins All', 'Love Wins All', 80, 'Eb Major', 'Grand'],
      ['Celebrity', 'Celebrity', 110, 'F Major', 'Cheerful'],
      ['Eight', 'Eight', 120, 'E Major', 'Nostalgic'],
      ['Bbibbi', 'Bbibbi', 105, 'C# Minor', 'Sassy'],
      ['Love Poem', 'Love Poem', 72, 'Db Major', 'Sad'],
      ['Ending Scene', 'Ending Scene', 70, 'C Major', 'Sad'],
      ['Peach', '桃子', 85, 'D Major', 'Sweet'],
      ['Friday', '星期五', 90, 'A Major', 'Chill'],
      ['My Sea', '我的海', 74, 'Ab Major', 'Grand'],
      ['Unlucky', 'Unlucky', 118, 'C Major', 'Playful'],
      ['Ah Puh', 'Ah Puh', 110, 'Bb Major', 'Playful'],
      ['Epilogue', '尾声', 75, 'C Major', 'Introspective'],
      ['Winter Sleep', '冬眠', 72, 'F Major', 'Cozy'],
      ['Shh..', 'Shh..', 92, 'F Minor', 'Mysterious'],
      ['Shopper', 'Shopper', 126, 'E Major', 'Anthemic'],
      ['Holssi', 'Holssi', 95, 'G Minor', 'Sassy']
    ]
  },
  {
    id: 'gd',
    name: 'G-Dragon',
    chineseName: '权志龙',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#00E5FF',
    desc: 'The King of K-Pop fashion and hip-hop avant-garde.',
    songs: [
      ['Crooked', 'Crooked', 128, 'G Major', 'Rebellious'],
      ['Untitled 2014', 'Untitled, 2014', 72, 'C Major', 'Melancholic'],
      ['Heartbreaker', 'Heartbreaker', 122, 'D Minor', 'Bold'],
      ['Crayon', 'Crayon', 126, 'E Minor', 'Zany'],
      ['One of a Kind', 'One of a Kind', 88, 'C Minor', 'Bold'],
      ['Who You?', 'Who You?', 100, 'A Major', 'Sarcastic'],
      ['Black', 'Black', 82, 'G Minor', 'Atmospheric'],
      ['Super Star', 'Super Star', 110, 'F Major', 'Vulnerability'],
      ['Divina Commedia', 'Divina Commedia', 90, 'A Minor', 'Avant-garde'],
      ['POWER', 'POWER', 124, 'D Minor', 'Anthemic'],
      ['That XX', 'That XX', 85, 'B Minor', 'Bitter'],
      ['Butterfly', 'Butterfly', 95, 'G Major', 'Dreamy'],
      ['A Boy', 'A Boy', 122, 'C Major', 'Inspiring'],
      ['R.O.D', 'R.O.D', 115, 'F Minor', 'Seductive'],
      ['Shake the World', 'Shake the World', 125, 'E Minor', 'Zany'],
      ['Niliria', 'Niliria', 105, 'D Minor', 'Ethnic'],
      ['Runaway', 'Runaway', 128, 'C# Minor', 'Bold']
    ]
  },
  {
    id: 'suga',
    name: 'SUGA',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#0EA5E9',
    desc: 'BTS rapper-producer Agust D, dealing in raw, introspective hip-hop.',
    searchArtist: 'Agust D',
    itunesArtists: ['Agust D', 'SUGA', 'BTS'],
    songs: [
      ['People', 'People', 85, 'G Major', 'Chill'],
      ['Haegeum', 'Haegeum', 126, 'E Minor', 'Aggressive'],
      ['Amygdala', 'Amygdala', 120, 'F Minor', 'Cathartic'],
      ['Polar Night', 'Polar Night', 88, 'C Minor', 'Dark'],
      ['Interlude Shadow', 'Shadow', 110, 'Db Minor', 'Intense'],
      ['SDL', 'SDL', 105, 'Bb Major', 'Cozy'],
      ['Strange', 'Strange', 92, 'F# Minor', 'Sarcastic'],
      ['Burn It', 'Burn It', 114, 'G Minor', 'Intense']
    ]
  },
  {
    id: 'taeyeon',
    name: 'Taeyeon',
    chineseName: '金泰妍',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#6366F1',
    desc: 'The definitive vocal queen of Girls\' Generation and solo stardom.',
    songs: [
      ['I', 'I', 110, 'A Major', 'Hopeful'],
      ['Rain', 'Rain', 84, 'F Minor', 'Melancholic'],
      ['Fine', 'Fine', 78, 'Eb Major', 'Emotional'],
      ['Four Seasons', '四季', 92, 'E Minor', 'Sensual'],
      ['Spark', '火花', 120, 'D Minor', 'Fiery'],
      ['Weekend', 'Weekend', 114, 'C Major', 'Cheerful'],
      ['INVU', 'INVU', 122, 'G Minor', 'Ethereal'],
      ['What Do I Call You', 'What Do I Call You', 98, 'B Minor', 'Chill'],
      ['To. X', 'To. X', 88, 'C Major', 'Cool'],
      ['Heaven', 'Heaven', 118, 'F# Minor', 'Grand'],
      ['11:11', '11:11', 82, 'C Major', 'Cozy'],
      ['Happy', 'Happy', 112, 'Bb Major', 'Cheerful'],
      ['Dear Me', '致我', 75, 'Eb Major', 'Empowering'],
      ['Stay', 'Stay', 84, 'A Major', 'Emotional'],
      ['Voice', 'Voice', 120, 'F Major', 'Anthemic'],
      ['Something New', 'Something New', 105, 'D Minor', 'Sassy'],
      ['Why', 'Why', 122, 'A Minor', 'Cheerful']
    ]
  },
  {
    id: 'jennie',
    name: 'JENNIE',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#10B981',
    desc: 'Global fashion and dance-pop icon from BLACKPINK.',
    itunesArtists: ['JENNIE', 'BLACKPINK', 'ZICO', 'G-DRAGON', 'The Weeknd'],
    songs: [
      ['SOLO', 'SOLO', 95, 'D Minor', 'Empowering'],
      ['You & Me', 'You & Me', 112, 'A Minor', 'Seductive'],
      ['One of the Girls', 'One of the Girls', 84, 'F Minor', 'Sensual'],
      ['Mantra', 'Mantra', 118, 'G Minor', 'Bold'],
      ['Spot!', 'Spot!', 122, 'E Minor', 'Energetic'],
      ['Black', 'Black (Feat.)', 82, 'G Minor', 'Atmospheric'],
      ['like JENNIE', 'like JENNIE', 140, 'C# Minor', 'Bold'],
      ['Handlebars', 'Handlebars', 105, 'G Minor', 'Sassy'],
      ['ExtraL', 'ExtraL', 130, 'F Minor', 'Bold'],
      ['Love Hangover', 'Love Hangover', 112, 'A Minor', 'Seductive'],
      ['ZEN', 'ZEN', 118, 'D Minor', 'Ethereal'],
      ['Starlight', 'Starlight', 105, 'Db Major', 'Cozy']
    ]
  },
  {
    id: 'rose',
    name: 'ROSÉ',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#06B6D4',
    desc: 'The unique, raspy vocal color and indie-rock star of BLACKPINK.',
    itunesArtists: ['ROSÉ', 'BLACKPINK', 'Bruno Mars'],
    songs: [
      ['On The Ground', 'On The Ground', 122, 'G Major', 'Empowering'],
      ['Gone', 'Gone', 80, 'F Major', 'Melancholic'],
      ['APT.', 'APT.', 140, 'E Major', 'Zany'],
      ['number one girl', 'number one girl', 88, 'C Major', 'Emotional'],
      ['toxic till the end', 'toxic till the end', 122, 'A Minor', 'Dramatic'],
      ['3am', '3am', 96, 'F Major', 'Bitter'],
      ['two years', 'two years', 80, 'G Major', 'Melancholic'],
      ['stay a little longer', 'stay a little longer', 84, 'Ab Major', 'Emotional'],
      ['messy', 'messy', 110, 'D Minor', 'Vulnerable']
    ]
  },
  {
    id: 'lisa',
    name: 'LISA',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#F59E0B',
    desc: 'BLACKPINK\'s global dance and rap prodigy.',
    itunesArtists: ['LISA', 'BLACKPINK', 'TAEYANG'],
    songs: [
      ['LALISA', 'LALISA', 125, 'C Minor', 'Bold'],
      ['MONEY', 'MONEY', 140, 'F Minor', 'Bold'],
      ['Rockstar', 'Rockstar', 128, 'E Minor', 'Bold'],
      ['New Woman', 'New Woman', 114, 'C Minor', 'Futuristic'],
      ['SG', 'SG (Feat.)', 105, 'G Minor', 'Latin'],
      ['Shoong!', 'Shoong! (Feat.)', 118, 'B Minor', 'Seductive'],
      ['Moonlit Floor', 'Moonlit Floor', 110, 'F# Minor', 'Seductive'],
      ['Thunder', 'Thunder', 124, 'C Minor', 'Bold'],
      ['Elastigirl', 'Elastigirl', 128, 'G Minor', 'Zany'],
      ['Dream', 'Dream', 84, 'C Major', 'Dreamy'],
      ['Born Again', 'Born Again', 118, 'A Minor', 'Empowering'],
      ['When I\'m With You', 'When I\'m With You', 112, 'E Major', 'Sweet']
    ]
  },
  {
    id: 'newjeans',
    name: 'NewJeans',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#8B5CF6',
    desc: 'Pioneered the nostalgic, easy-listening Y2K R&B aesthetics in K-Pop.',
    songs: [
      ['Ditto', 'Ditto', 134, 'F# Minor', 'Nostalgic'],
      ['Hype Boy', 'Hype Boy', 110, 'A Minor', 'Cheerful'],
      ['Attention', 'Attention', 105, 'B Minor', 'Cool'],
      ['OMG', 'OMG', 127, 'A Major', 'Playful'],
      ['Super Shy', 'Super Shy', 150, 'F Major', 'Cheerful'],
      ['Cookie', 'Cookie', 142, 'D Minor', 'Cool'],
      ['Hurt', 'Hurt', 82, 'G Major', 'Cozy'],
      ['ETA', 'ETA', 135, 'C Minor', 'Energetic'],
      ['Cool With You', 'Cool With You', 130, 'G Minor', 'Dreamy'],
      ['Get Up', 'Get Up', 78, 'F# Minor', 'Atmospheric'],
      ['ASAP', 'ASAP', 126, 'C Major', 'Zany'],
      ['How Sweet', 'How Sweet', 116, 'G Major', 'Cool'],
      ['Bubble Gum', 'Bubble Gum', 108, 'E Major', 'Sweet'],
      ['Supernatural', 'Supernatural', 112, 'D Minor', 'Cool'],
      ['Right Now', 'Right Now', 120, 'C Major', 'Playful'],
      ['New Jeans', 'New Jeans', 134, 'Bb Major', 'Playful'],
      ['Zero', 'Zero', 128, 'E Minor', 'Electronic'],
      ['Our Night', 'Our Night is More Beautiful Than Your Day', 95, 'F Major', 'Nostalgic']
    ]
  },
  {
    id: 'aespa',
    name: 'aespa',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#C084FC',
    desc: 'Futuristic hyperpop and heavy cyber-electronic beats.',
    songs: [
      ['Black Mamba', 'Black Mamba', 120, 'D Minor', 'Futuristic'],
      ['Next Level', 'Next Level', 112, 'B Minor', 'Bold'],
      ['Savage', 'Savage', 145, 'C# Minor', 'Zany'],
      ['Drama', 'Drama', 124, 'F# Minor', 'Fiery'],
      ['Supernova', 'Supernova', 125, 'E Minor', 'Futuristic'],
      ['Armageddon', 'Armageddon', 128, 'F Minor', 'Futuristic'],
      ['Spicy', 'Spicy', 122, 'C Minor', 'Fiery'],
      ['Girls', 'Girls', 125, 'D Minor', 'Anthemic'],
      ['Dreams Come True', 'Dreams Come True', 110, 'Ab Major', 'Dreamy'],
      ['Illusion', 'Illusion', 122, 'C# Minor', 'Seductive'],
      ['Hold On Tight', 'Hold On Tight', 132, 'G Minor', 'Energetic'],
      ['Better Things', 'Better Things', 115, 'A Major', 'Cheerful'],
      ['Licorice', 'Licorice', 120, 'E Minor', 'Fiery'],
      ['Prologue', 'Prologue', 80, 'C Major', 'Cozy'],
      ['Melody', 'Melody', 88, 'F Major', 'Cozy'],
      ['Thirsty', 'Thirsty', 110, 'A Minor', 'Sensual'],
      ['Salty & Sweet', 'Salty & Sweet', 124, 'C# Minor', 'Seductive'],
      ['Mine', 'Mine', 120, 'D Minor', 'Dark'],
      ['Bahama', 'Bahama', 118, 'C Major', 'Sweet'],
      ['Regret of the Times', '时代遗憾', 128, 'E Minor', 'Futuristic']
    ]
  },
  {
    id: 'seventeen',
    name: 'SEVENTEEN',
    chineseName: '十七',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#818CF8',
    desc: 'Dynamic self-producing group renowned for synchronized choreography and bright, energetic sounds.',
    songs: [
      ['Super', '손오공', 136, 'G Minor', 'Anthemic'],
      ['Don\'t Wanna Cry', '울고 싶지 않아', 100, 'A Minor', 'Emotional'],
      ['Very Nice', '아주 NICE', 128, 'Db Major', 'Cheerful'],
      ['Hot', 'HOT', 112, 'F Minor', 'Fiery'],
      ['Left & Right', 'Left & Right', 120, 'G Major', 'Playful'],
      ['Rock with you', 'Rock with you', 125, 'D Minor', 'Energetic'],
      ['Maestro', 'MAESTRO', 130, 'E Minor', 'Dramatic'],
      ['God of Music', '음악의 신', 122, 'Ab Major', 'Cheerful'],
      ['Pretty U', '예쁘다', 118, 'C Major', 'Sweet'],
      ['Mansae', '만세', 125, 'G Major', 'Cheerful'],
      ['Adore U', '아낀다', 115, 'Bb Major', 'Playful'],
      ['Clap', '박수', 132, 'D Minor', 'Anthemic'],
      ['Home', 'Home', 85, 'F Major', 'Warm'],
      ['Thanks', '고맙다', 124, 'Ab Major', 'Emotional'],
      ['Fear', '독', 110, 'C# Minor', 'Dark'],
      ['Dar+ling', 'Dar+ling', 116, 'E Major', 'Sweet'],
      ['_WORLD', '_WORLD', 118, 'A Major', 'Cheerful'],
      ['Spell', 'Spell', 122, 'F Minor', 'Sensual'],
      ['LALALI', 'LALALI', 128, 'B Minor', 'Bold'],
      ['To You', 'To You', 124, 'C Major', 'Hopeful']
    ]
  },
  {
    id: 'redvelvet',
    name: 'Red Velvet',
    chineseName: '红色天鹅绒',
    region: 'region_kr',
    genre: 'genre_rnb',
    color: '#E11D48',
    desc: 'Versatile group combining quirky, sweet "Red" pop with smooth, dark R&B "Velvet" tracks.',
    songs: [
      ['Psycho', 'Psycho', 97, 'Ab Major', 'Dramatic'],
      ['Bad Boy', 'Bad Boy', 150, 'G Minor', 'Sensual'],
      ['Red Flavor', '빨간 맛', 125, 'A Major', 'Cheerful'],
      ['Peek-A-Boo', '피카부', 115, 'C# Minor', 'Mysterious'],
      ['Feel My Rhythm', 'Feel My Rhythm', 122, 'G Major', 'Ethereal'],
      ['Russian Roulette', '러시안 룰렛', 130, 'E Minor', 'Playful'],
      ['Dumb Dumb', 'Dumb Dumb', 137, 'B Minor', 'Energetic'],
      ['Ice Cream Cake', 'Ice Cream Cake', 134, 'Bb Major', 'Zany'],
      ['Cosmic', 'Cosmic', 118, 'F Major', 'Dreamy'],
      ['Queendom', 'Queendom', 120, 'Eb Major', 'Hopeful'],
      ['Power Up', 'Power Up', 128, 'G Major', 'Cheerful'],
      ['Sunny Side Up!', 'Sunny Side Up!', 94, 'F Minor', 'Groovy'],
      ['Zimzalabim', '짐살라빔', 128, 'D Minor', 'Zany'],
      ['Rookie', 'Rookie', 120, 'C Major', 'Playful'],
      ['One of These Nights', '7월 7일', 72, 'Ab Major', 'Sad'],
      ['Kingdom Come', 'Kingdom Come', 82, 'Eb Major', 'Smooth'],
      ['Automatic', 'Automatic', 90, 'F# Minor', 'Sensual'],
      ['Blue Lemonade', 'Blue Lemonade', 114, 'D Major', 'Sweet'],
      ['In My Dreams', 'In My Dreams', 80, 'Bb Major', 'Dreamy'],
      ['Bamboleo', 'Bamboleo', 116, 'A Major', 'Groovy']
    ]
  },
  {
    id: 'nct127',
    name: 'NCT 127',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#A3E635',
    desc: 'Neo-culture pioneers known for their experimental, bass-heavy, and high-energy neo-pop.',
    songs: [
      ['Kick It', '영웅', 137, 'E Minor', 'Aggressive'],
      ['Cherry Bomb', 'Cherry Bomb', 135, 'C Minor', 'Bold'],
      ['2 Baddies', '질주', 120, 'G Minor', 'Aggressive'],
      ['Fact Check', '팩트체크', 125, 'D Minor', 'Bold'],
      ['Sticker', 'Sticker', 120, 'C# Minor', 'Zany'],
      ['Simon Says', 'Simon Says', 122, 'F# Minor', 'Aggressive'],
      ['Favorite', 'Favorite (Vampire)', 134, 'A Minor', 'Dramatic'],
      ['Regular', 'Regular', 95, 'C Minor', 'Bold'],
      ['Limitless', '무한적아', 115, 'F Minor', 'Powerful'],
      ['Fire Truck', '소방차', 120, 'B Minor', 'Energetic'],
      ['Walk', 'Walk', 108, 'E Minor', 'Chic'],
      ['Ay-Yo', 'Ay-Yo', 98, 'F Minor', 'Cool'],
      ['Highway to Heaven', 'Highway to Heaven', 120, 'F Major', 'Hopeful'],
      ['Superhuman', 'Superhuman', 125, 'G Major', 'Futuristic'],
      ['Touch', 'Touch', 110, 'D Major', 'Sweet'],
      ['Punch', 'Punch', 122, 'D Minor', 'Aggressive'],
      ['Lemonade', 'Lemonade', 132, 'G Minor', 'Sassy'],
      ['Chain', 'Chain', 125, 'C Minor', 'Aggressive'],
      ['Gimme Gimme', 'gimme gimme', 112, 'E Minor', 'Intense'],
      ['Baby Don\'t Like It', '나쁜 짓', 85, 'D Minor', 'Sensual']
    ]
  },
  {
    id: 'txt',
    name: 'TXT',
    chineseName: 'Tomorrow X Together',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#22D3EE',
    desc: 'Storytellers of youth, exploring rock-infused pop, indie, and alternative electronic genres.',
    searchArtist: 'TOMORROW X TOGETHER',
    itunesArtists: ['TOMORROW X TOGETHER', 'TXT'],
    songs: [
      ['Crown', '어느날 머리에서 뿔이 자랐다', 125, 'F Major', 'Cheerful'],
      ['Blue Hour', '5시 53분의 하늘에서 발견한 너와 나', 114, 'G Major', 'Cheerful'],
      ['0X1=LOVESONG', 'I Know I Love You', 120, 'D Minor', 'Anthemic'],
      ['LO$ER=LO♡ER', 'LO$ER=LO♡ER', 125, 'E Minor', 'Emotional'],
      ['Sugar Rush Ride', 'Sugar Rush Ride', 125, 'C# Minor', 'Seductive'],
      ['Chasing That Feeling', 'Chasing That Feeling', 132, 'D Minor', 'Retro'],
      ['Deja Vu', 'Deja Vu', 128, 'A Minor', 'Dramatic'],
      ['9 and Three Quarters (Run Away)', '9와 4분의 3 승강장에서 너를 기다려', 130, 'Bb Major', 'Hopeful'],
      ['Cat & Dog', 'Cat & Dog', 122, 'C Minor', 'Playful'],
      ['Anti-Romantic', 'Anti-Romantic', 80, 'C Major', 'Sad'],
      ['Tinnitus', '돌멩이가 되고 싶어', 108, 'F Minor', 'Groovy'],
      ['Farewell, Neverland', 'Farewell, Neverland', 95, 'G Minor', 'Emotional'],
      ['Can\'t You See Me?', '세계가 불타버린 밤, 우린...', 115, 'C Minor', 'Dark'],
      ['Puma', '동물원을 탈출한 퓨마', 122, 'B Minor', 'Aggressive'],
      ['Ghosting', 'Ghosting', 110, 'A Major', 'Dreamy'],
      ['New Rules', 'New Rules', 128, 'E Minor', 'Cheerful'],
      ['Drama', 'Drama', 125, 'Ab Major', 'Cheerful'],
      ['Blue Spring', 'Blue Spring', 76, 'C Major', 'Warm'],
      ['We Lost The Summer', '날씨를 잃어버렸어', 112, 'A Minor', 'Nostalgic'],
      ['Opening Sequence', 'Opening Sequence', 90, 'Db Minor', 'Dramatic']
    ]
  },
  {
    id: 'exo',
    name: 'EXO',
    region: 'region_kr',
    genre: 'genre_rnb',
    color: '#94A3B8',
    desc: 'Vocal powerhouses of K-pop, blending elegant harmony with smooth urban R&B and synth-pop.',
    songs: [
      ['Growl', '으르렁', 110, 'E Minor', 'Chic'],
      ['Monster', 'Monster', 118, 'C Minor', 'Intense'],
      ['Call Me Baby', 'Call Me Baby', 110, 'A Major', 'Cheerful'],
      ['Love Shot', 'Love Shot', 100, 'D Minor', 'Sensual'],
      ['Ko Ko Bop', 'Ko Ko Bop', 95, 'E Minor', 'Reggae'],
      ['Tempo', 'Tempo', 120, 'D Minor', 'Complex'],
      ['Overdose', '중독', 125, 'C Minor', 'Powerful'],
      ['Cream Soda', 'Cream Soda', 112, 'Bb Major', 'Groovy'],
      ['Obsession', 'Obsession', 115, 'Db Minor', 'Dark'],
      ['Don\'t Fight the Feeling', 'Don\'t Fight the Feeling', 122, 'A Major', 'Hopeful'],
      ['Lotto', 'Lotto', 108, 'F Minor', 'Sassy'],
      ['The Eve', '전夜', 90, 'C# Minor', 'Sensual'],
      ['The First Snow', '첫 눈', 78, 'C Major', 'Cozy'],
      ['Lucky One', 'Lucky One', 114, 'E Major', 'Funky'],
      ['History', 'History', 125, 'A Minor', 'Powerful'],
      ['Mama', 'MAMA', 120, 'D Minor', 'Grand'],
      ['Baby Don\'t Cry', '인어의 눈물', 82, 'G Major', 'Emotional'],
      ['Miracles in December', '12월의 기적', 72, 'C Major', 'Sad'],
      ['Universe', 'Universe', 84, 'Ab Major', 'Emotional']
    ]
  },
  {
    id: 'babymonster',
    name: 'BABYMONSTER',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#DC2626',
    desc: 'Monstrous rookies blending strong rap skills with soaring vocals and swaggering hip-hop beats.',
    songs: [
      ['SHEESH', 'SHEESH', 135, 'D Minor', 'Bold'],
      ['BATTER UP', 'BATTER UP', 130, 'C Minor', 'Bold'],
      ['LIKE THAT', 'LIKE THAT', 115, 'F# Minor', 'Sensual'],
      ['CLIK CLAK', 'CLIK CLAK', 90, 'C Minor', 'Aggressive'],
      ['DRIP', 'DRIP', 122, 'F Minor', 'Energetic'],
      ['Stuck In The Middle', 'Stuck In The Middle', 74, 'C Major', 'Sad'],
      ['Forever', 'Forever', 124, 'A Major', 'Hopeful'],
      ['Love In My Heart', 'Love In My Heart', 110, 'F Major', 'Sweet'],
      ['Dream', 'Dream', 82, 'Ab Major', 'Hopeful'],
      ['BILLIONAIRE', 'BILLIONAIRE', 120, 'F Minor', 'Bold'],
      ['Really Like You', 'Really Like You', 108, 'C Major', 'Sweet'],
      ['WE GO UP', 'WE GO UP', 126, 'D Minor', 'Energetic'],
      ['HOT SAUCE', 'HOT SAUCE', 122, 'C# Minor', 'Fiery']
    ]
  },
  {
    id: 'itzy',
    name: 'ITZY',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#F43F5E',
    desc: 'Queens of self-confidence with high-energy dance-pop, bright synths, and empowering concepts.',
    songs: [
      ['DALLA DALLA', '달라달라', 125, 'C Minor', 'Bold'],
      ['Wannabe', 'Wannabe', 122, 'F# Minor', 'Empowering'],
      ['ICY', 'ICY', 120, 'C Major', 'Cheerful'],
      ['Not Shy', 'Not Shy', 105, 'D Minor', 'Bold'],
      ['LOCO', 'LOCO', 120, 'E Minor', 'Energetic'],
      ['In the morning', '마.피.아. In the morning', 132, 'G Minor', 'Bold'],
      ['Sneakers', 'Sneakers', 120, 'A Major', 'Cheerful'],
      ['Cake', 'Cake', 114, 'D Major', 'Playful'],
      ['Untouchable', 'Untouchable', 122, 'B Minor', 'Bold'],
      ['Gold', 'Gold', 128, 'F# Minor', 'Fiery'],
      ['Ringo', 'Ringo', 124, 'E Minor', 'Energetic'],
      ['Cheshire', 'Cheshire', 108, 'Ab Major', 'Mysterious'],
      ['Voltage', 'Voltage', 125, 'D Minor', 'Fiery'],
      ['Blah Blah Blah', 'Blah Blah Blah', 120, 'C Minor', 'Bold'],
      ['Surf', 'Surf', 110, 'Eb Major', 'Sweet'],
      ['Swipe', 'Swipe', 130, 'F# Minor', 'Sassy'],
      ['Twenty', 'Twenty', 125, 'G Minor', 'Energetic'],
      ['Mirror', 'Mirror', 76, 'F Major', 'Warm'],
      ['Shoot!', 'Shoot!', 100, 'D Minor', 'Groovy'],
      ['Gas Me Up', 'Gas Me Up', 118, 'C Minor', 'Sassy']
    ]
  },
  {
    id: 'shinee',
    name: 'SHINee',
    chineseName: '闪耀',
    region: 'region_kr',
    genre: 'genre_rnb',
    color: '#06B6D4',
    desc: 'Princes of K-pop, acclaimed for live vocals, trendsetting fashion, and innovative contemporary R&B.',
    songs: [
      ['Replay', '누난 너무 예뻐', 93, 'Db Major', 'Warm'],
      ['Ring Ding Dong', 'Ring Ding Dong', 125, 'Bb Minor', 'Zany'],
      ['Lucifer', 'Lucifer', 125, 'D Minor', 'Energetic'],
      ['Sherlock', 'Clue + Note', 120, 'F Minor', 'Dramatic'],
      ['View', 'View', 125, 'F Major', 'Deep House'],
      ['Don\'t Call Me', 'Don\'t Call Me', 128, 'G Minor', 'Aggressive'],
      ['Hard', 'HARD', 97, 'E Minor', 'Hip-hop'],
      ['Everybody', 'Everybody', 128, 'B Minor', 'Energetic'],
      ['Dream Girl', 'Dream Girl', 125, 'A Major', 'Funky'],
      ['Love Like Oxygen', '산소 같은 너', 115, 'C Major', 'Smooth'],
      ['Juliette', '줄리엣', 118, 'F# Major', 'Groovy'],
      ['Hello', 'Hello', 105, 'G Major', 'Sweet'],
      ['Green Rain', '초록비', 110, 'C Major', 'Hopeful'],
      ['Good Evening', '데리러 가', 118, 'D Minor', 'Ethereal'],
      ['Our Page', '네가 남겨둔 말', 78, 'Ab Major', 'Emotional'],
      ['Married To The Music', 'Married To The Music', 122, 'G Major', 'Funky'],
      ['Amigo', '아.미.고', 125, 'C# Minor', 'Energetic'],
      ['Tell Me What To Do', 'Tell Me What To Do', 90, 'F Minor', 'Emotional'],
      ['Colorful', 'Colorful', 114, 'D Major', 'Cheerful'],
      ['Aside', '방백', 84, 'Eb Major', 'Warm']
    ]
  },
  {
    id: 'bigbang',
    name: 'BIGBANG',
    chineseName: '爆炸',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#FBBF24',
    desc: 'Legendary group who shaped the modern K-pop scene with revolutionary hip-hop and electronic soundscapes.',
    songs: [
      ['Bang Bang Bang', '뱅뱅뱅', 135, 'F Minor', 'Anthemic'],
      ['Fantastic Baby', 'Fantastic Baby', 130, 'B Minor', 'Energetic'],
      ['Haru Haru', '하루하루', 90, 'C Minor', 'Emotional'],
      ['Lies', '거짓말', 125, 'F Minor', 'Nostalgic'],
      ['Loser', 'LOSER', 85, 'G Major', 'Melancholic'],
      ['Bae Bae', 'BAE BAE', 112, 'D Minor', 'Zany'],
      ['Last Dance', 'Last Dance', 74, 'C Major', 'Sad'],
      ['Fxxk It', '에라 모르겠다', 90, 'C Minor', 'Cool'],
      ['Flower Road', '꽃길', 100, 'A Major', 'Emotional'],
      ['Still Life', '봄여름가을겨울', 78, 'Db Major', 'Poetic'],
      ['Blue', 'BLUE', 115, 'E Minor', 'Melancholic'],
      ['Bad Boy', 'BAD BOY', 95, 'F Minor', 'Smooth'],
      ['Monster', 'MONSTER', 120, 'D Minor', 'Dramatic'],
      ['Love Song', 'Love Song', 110, 'C Major', 'Hopeful'],
      ['Tonight', 'Tonight', 125, 'G Minor', 'Anthemic'],
      ['Sunset Glow', '붉은 노을', 130, 'Bb Major', 'Cheerful'],
      ['Heaven', '천국', 125, 'Eb Major', 'Hopeful'],
      ['Always', 'Always', 118, 'C Major', 'Sweet'],
      ['Gara Gara Go!!', 'Gara Gara Go!!', 125, 'E Minor', 'Energetic'],
      ['My Heaven', 'My Heaven', 126, 'D Minor', 'Dramatic']
    ]
  },
  {
    id: 'jungkook',
    name: 'Jungkook',
    chineseName: '田柾国',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#6D28D9',
    desc: 'The Golden Maknae of BTS, conquering global charts with smooth pop, UK garage, and R&B styles.',
    searchArtist: 'Jung Kook',
    itunesArtists: ['Jung Kook', 'BTS'],
    songs: [
      ['Seven', 'Seven', 125, 'B Minor', 'Seductive'],
      ['3D', '3D', 108, 'F# Minor', 'Groovy'],
      ['Standing Next to You', 'Standing Next to You', 116, 'C Minor', 'Anthemic'],
      ['Yes or No', 'Yes or No', 110, 'G Major', 'Hopeful'],
      ['Please Don\'t Change', 'Please Don\'t Change', 120, 'A Minor', 'Energetic'],
      ['Hate You', 'Hate You', 72, 'Eb Major', 'Sad'],
      ['Closer to You', 'Closer to You', 112, 'D Minor', 'Sensual'],
      ['Too Sad to Dance', 'Too Sad to Dance', 95, 'C Major', 'Chill'],
      ['Somebody', 'Somebody', 100, 'A Minor', 'Chill'],
      ['Shot Glass of Tears', 'Shot Glass of Tears', 80, 'Bb Major', 'Sad'],
      ['Stay Alive', 'Stay Alive', 125, 'D Minor', 'Dramatic'],
      ['Still With You', 'Still With You', 84, 'A Minor', 'Romantic'],
      ['Dreamers', 'Dreamers', 115, 'Bb Major', 'Hopeful'],
      ['My Time', '시차', 120, 'F Minor', 'R&B'],
      ['Euphoria', 'Euphoria', 120, 'Ab Major', 'Hopeful'],
      ['Never Let Go', 'Never Let Go', 122, 'C Major', 'Cheerful'],
      ['Standing Next to You (USHER Remix)', 'Standing Next to You (USHER Remix)', 116, 'C Minor', 'Bold']
    ]
  },
  {
    id: 'ateez',
    name: 'ATEEZ',
    chineseName: '에이티즈',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#F97316',
    desc: 'Performance-driven group known for cinematic concepts, explosive choreography, and anthemic sound.',
    songs: [
      ['BOUNCY (K-HOT CHILLI PEPPERS)'], ['WORK'], ['Crazy Form'], ['Ice On My Teeth'],
      ['Guerrilla'], ['HALAZIA'], ['Deja Vu'], ['INCEPTION'], ['Say My Name'],
      ['WONDERLAND'], ['Answer'], ['WAVE']
    ]
  },
  {
    id: 'enhypen',
    name: 'ENHYPEN',
    chineseName: '엔하이픈',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#7C3AED',
    desc: 'Dark-pop storytellers blending polished performance, supernatural lore, and sleek contemporary production.',
    songs: [
      ['Bite Me'], ['Drunk-Dazed'], ['XO (Only If You Say Yes)'], ['FEVER'],
      ['Sweet Venom'], ['Given-Taken'], ['Polaroid Love'], ['No Doubt'],
      ['Tamed-Dashed'], ['Future Perfect (Pass the MIC)'], ['Blessed-Cursed'], ['SHOUT OUT']
    ]
  },
  {
    id: 'gidle',
    name: '(G)I-DLE',
    chineseName: '아이들',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#E11D48',
    desc: 'Self-producing girl group recognized for bold concepts, sharp songwriting, and constant reinvention.',
    searchArtist: 'i-dle',
    itunesArtists: ['i-dle', '(G)I-DLE', 'K/DA'],
    songs: [
      ['Queencard'], ['Nxde'], ['TOMBOY'], ['Super Lady'], ['LATATA'], ['Oh my god'],
      ['MY BAG'], ['HANN (Alone)'], ['Señorita'], ['HWAA'], ['LION'], ['Uh-Oh']
    ]
  },
  {
    id: 'mamamoo',
    name: 'MAMAMOO',
    chineseName: '마마무',
    region: 'region_kr',
    genre: 'genre_rnb',
    color: '#22C55E',
    desc: 'Vocal powerhouse quartet celebrated for commanding live stages, rich harmonies, and playful charisma.',
    songs: [
      ['HIP'], ['Egotistic'], ['gogobebe'], ['Starry Night'], ['Aya'], ['Dingga'],
      ['Decalcomanie'], ['Um Oh Ah Yeh'], ['WANNA BE MYSELF'], ['Yes I Am'],
      ['Wind flower'], ['ILLELLA']
    ]
  },
  {
    id: 'nmixx',
    name: 'NMIXX',
    chineseName: '엔믹스',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#38BDF8',
    desc: 'Technically gifted group pushing mix-pop through abrupt genre turns and powerful live vocals.',
    songs: [
      ['DICE'], ['Love Me Like This'], ['O.O'], ['DASH'], ['Run For Roses'], ['TANK'],
      ['See that?'], ['Roller Coaster'], ['Soñar (Breaker)'], ["Party O'Clock"],
      ['Young, Dumb, Stupid'], ['Passionfruit']
    ]
  },
  {
    id: 'stayc',
    name: 'STAYC',
    chineseName: '스테이씨',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#FB7185',
    desc: 'Bright pop specialists pairing crisp hooks and distinctive vocals with an energetic teen-fresh identity.',
    songs: [
      ['ASAP'], ['RUN2U'], ['STEREOTYPE'], ['SO BAD'], ['Bubble'], ['Teddy Bear'],
      ['Poppy'], ['YOUNG LUV'], ['BEAUTIFUL MONSTER'], ['Cheeky Icy Thang'],
      ['SLOW DOWN'], ['LOVE FOOL']
    ]
  },
  {
    id: 'illit',
    name: 'ILLIT',
    chineseName: '아일릿',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#A78BFA',
    desc: 'Dreamy new-generation group combining light-footed dance pop with playful digital-age aesthetics.',
    songs: [
      ['Magnetic'], ['NOT CUTE ANYMORE'], ['Cherish (My Love)'], ['Tick-Tack'],
      ['Lucky Girl Syndrome'], ['Billyeoon Goyangi (Do the Dance)'], ['IYKYK (If You Know You Know)'],
      ['Midnight Fiction'], ['My World'], ["I'll Like You"], ['Almond Chocolate'], ['Pimple']
    ]
  },
  {
    id: 'kissoflife',
    name: 'KISS OF LIFE',
    chineseName: '키스 오브 라이프',
    region: 'region_kr',
    genre: 'genre_rnb',
    color: '#DC2626',
    desc: 'Confident vocal group channeling contemporary R&B, Y2K pop, and performance-led storytelling.',
    songs: [
      ['Sticky'], ['Midas Touch'], ['Shhh'], ['Bad News'], ['Nobody Knows'], ['Igloo'],
      ['Get Loud'], ['Te Quiero'], ['Nothing'], ['TTG'], ['My 808'], ['Bye My Neverland']
    ]
  },
  {
    id: 'fiftyfifty',
    name: 'FIFTY FIFTY',
    chineseName: '피프티 피프티',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#F9A8D4',
    desc: 'Melodic girl group known for airy vocals, easy-listening production, and globally resonant hooks.',
    songs: [
      ['Cupid'], ['Higher'], ["Lovin' Me"], ['Tell Me'], ['Starry Night'], ['SOS'],
      ['Gravity'], ['Push Your Love'], ['Midnight Special'], ['Pookie'],
      ['Naughty or Nice'], ['When You Say My Name']
    ]
  },
  {
    id: 'kep1er',
    name: 'Kep1er',
    chineseName: '케플러',
    region: 'region_kr',
    genre: 'genre_dance',
    color: '#8B5CF6',
    desc: 'High-energy project group combining precision choreography with colorful, futuristic dance pop.',
    songs: [
      ['WA DA DA'], ['Up!'], ['Giddy'], ['Galileo'], ['Shooting Star'], ['TIPI-TAP'],
      ['MVSK'], ['Back to the City'], ['We Fresh'], ['Grand Prix'], ['Straight Line'], ['Double Up!']
    ]
  },
  {
    id: 'dreamcatcher',
    name: 'Dreamcatcher',
    chineseName: '드림캐쳐',
    region: 'region_kr',
    genre: 'genre_rock',
    color: '#7F1D1D',
    desc: 'Cult-favorite group fusing hard rock, electronic production, and dark fantasy into a singular sound.',
    songs: [
      ['BOCA'], ['Scream'], ['Deja Vu'], ['BONVOYAGE'], ['JUSTICE'], ['BEcause'],
      ['Odd Eye'], ['Chase Me'], ['Good Night'], ['You and I'], ['PIRI'], ['MAISON']
    ]
  },
  {
    id: 'nctdream',
    name: 'NCT DREAM',
    chineseName: '엔시티 드림',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#84CC16',
    desc: 'Youthful NCT unit evolving from bright teen pop into adventurous, high-impact performance music.',
    songs: [
      ['Hot Sauce'], ['Candy'], ['Glitch Mode'], ['Hello Future'], ['Beatbox'], ['BOOM'],
      ['We Go Up'], ["Ridin'"], ['ISTJ'], ['Smoothie'], ['Broken Melodies'], ["When I'm With You"]
    ]
  },
  {
    id: 'theboyz',
    name: 'THE BOYZ',
    chineseName: '더보이즈',
    region: 'region_kr',
    genre: 'genre_dance',
    color: '#2563EB',
    desc: 'Large-scale performance group known for synchronized choreography and polished cinematic concepts.',
    songs: [
      ['The Stealer'], ['ROAR'], ['MAVERICK'], ['THRILL RIDE'], ['WATCH IT'], ['REVEAL'],
      ['No Air'], ['Bloom Bloom'], ['LIP GLOSS'], ['D.D.D'], ['WHISPER'], ['Nectar']
    ]
  },
  {
    id: 'boynextdoor',
    name: 'BOYNEXTDOOR',
    chineseName: '보이넥스트도어',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#F59E0B',
    desc: 'Conversational pop group turning everyday youth stories into lively, personality-rich performances.',
    songs: [
      ['One and Only'], ['Earth, Wind & Fire'], ['But Sometimes'], ['Nice Guy'], ['I Feel Good'],
      ['If I Say, I Love You'], ['Serenade'], ['Dangerous'], ['But I Like You'],
      ['Crying'], ['Life Is Cool'], ['20']
    ]
  },
  {
    id: 'riize',
    name: 'RIIZE',
    chineseName: '라이즈',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#F97316',
    desc: 'Rising boy group built around emotional pop, youthful momentum, and performance-driven growth.',
    songs: [
      ['Get A Guitar'], ['Love 119'], ['Boom Boom Bass'], ['Talk Saxy'], ['Siren'],
      ['Impossible'], ['Memories'], ['Lucky'], ['Combo'], ['Fly Up'], ['Bag Bad Back'], ['Odyssey']
    ]
  },
  {
    id: 'zerobaseone',
    name: 'ZEROBASEONE',
    chineseName: '제로베이스원',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#60A5FA',
    desc: 'Fan-formed group balancing luminous youth pop with clean choreography and emotionally direct melodies.',
    songs: [
      ['In Bloom'], ['Feel the POP'], ['GOOD SO BAD'], ['CRUSH'], ['BLUE'], ['Doctor! Doctor!'],
      ['SWEAT'], ['New Kidz on the Block'], ['YURA YURA'], ['Kill the Romeo'],
      ['MELTING POINT'], ['Insomnia']
    ]
  },
  {
    id: 'tws',
    name: 'TWS',
    chineseName: '투어스',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#22D3EE',
    desc: 'Fresh-faced group specializing in bright school-age stories and buoyant, melodic dance pop.',
    songs: [
      ['plot twist'], ["If I'm S, Can You Be My N?"], ['hey! hey!'], ['Last Festival'],
      ['Countdown!'], ['BFF'], ['Double Take'], ['Oh Mymy : 7s'], ['first hooky'],
      ['Freestyle'], ['Keep On'], ['unplugged boy']
    ]
  },
  {
    id: 'p1harmony',
    name: 'P1Harmony',
    chineseName: '피원하모니',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#EF4444',
    desc: 'Charismatic performance group mixing hip-hop attitude, strong vocals, and energetic stagecraft.',
    songs: [
      ["Killin' It"], ['DUH!'], ['SAD SONG'], ['Back Down'], ['JUMP'], ['Do It Like This'],
      ['Scared'], ['SIREN'], ['Doom Du Doom'], ['Fall In Love Again'], ['EX'], ['Pretty Boy']
    ]
  },
  {
    id: 'xg',
    name: 'XG',
    chineseName: '엑스지',
    region: 'region_jp',
    genre: 'genre_hiphop',
    color: '#C084FC',
    desc: 'Japan-born global group operating from Seoul with sharp rap, R&B vocals, and futuristic visual direction.',
    songs: [
      ['WOKE UP'], ['SHOOTING STAR'], ['LEFT RIGHT'], ['TGIF'], ['GRL GVNG'], ['NEW DANCE'],
      ['WINTER WITHOUT YOU'], ["SOMETHING AIN'T RIGHT"], ['IYKYK'], ['HOWLING'], ['GALA'], ['IS THIS LOVE']
    ]
  },
  {
    id: 'qwer',
    name: 'QWER',
    chineseName: '큐더블유이알',
    region: 'region_kr',
    genre: 'genre_rock',
    color: '#EC4899',
    desc: 'Idol band bringing bright pop-rock hooks, live instrumentation, and internet-era personality to K-pop.',
    songs: [
      ['T.B.H'], ['Discord'], ['My Name Is Malguem'], ['Harmony of Stars'], ['Make Our Highlight'],
      ['Manito'], ['Ferris Wheel'], ['SODA'], ['Fake Idol'], ['Goodbye My Sadness'],
      ["Let's Love"], ['Dear']
    ]
  },
  {
    id: '2ne1',
    name: '2NE1',
    chineseName: '투애니원',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#D946EF',
    desc: 'Trailblazing girl group whose fearless attitude and genre-blending hits reshaped modern K-pop performance.',
    songs: [
      ['I Am the Best'], ['Fire'], ["Can't Nobody"], ['Lonely'], ['Ugly'], ['Come Back Home'],
      ['Missing You'], ["I Don't Care"], ['Go Away'], ['Falling in Love'], ['Happy'], ['Clap Your Hands']
    ]
  },
  {
    id: 'girlsgeneration',
    name: "Girls' Generation",
    chineseName: '少女时代',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#F472B6',
    desc: 'Defining second-generation girl group whose songs and performances set enduring K-pop standards.',
    searchArtist: "Girls' Generation",
    itunesArtists: ["Girls' Generation", 'SNSD'],
    songs: [
      ['Gee'], ['I GOT A BOY'], ['The Boys'], ['Into the New World'], ['Genie'], ['Oh!'],
      ['Lion Heart'], ['Mr.Mr.'], ['Run Devil Run'], ['PARTY'], ['Holiday'], ['FOREVER 1']
    ]
  },
  {
    id: 'superjunior',
    name: 'SUPER JUNIOR',
    chineseName: '슈퍼주니어',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#1D4ED8',
    desc: 'Long-running Hallyu leaders known for durable teamwork, variety charisma, and era-defining dance hits.',
    searchArtist: 'SUPER JUNIOR',
    itunesArtists: ['SUPER JUNIOR', 'Super Junior'],
    songs: [
      ['Sorry, Sorry'], ['Mr. Simple'], ['BONAMANA'], ['Black Suit'], ['Devil'], ['U'],
      ['MAMACITA'], ['Lo Siento'], ['House Party'], ['SUPER Clap'], ["It's You"], ["Don't Don"]
    ]
  },
  {
    id: 'got7',
    name: 'GOT7',
    chineseName: '갓세븐',
    region: 'region_kr',
    genre: 'genre_rnb',
    color: '#22C55E',
    desc: 'Globally minded group combining acrobatic performance, warm R&B, and self-directed musical growth.',
    songs: [
      ['Just Right'], ['Hard Carry'], ['Lullaby'], ['If You Do'], ['You Calling My Name'], ['NANANA'],
      ['Not By the Moon'], ['Never Ever'], ['Stop Stop It'], ['A'], ['Breath'], ['Last Piece']
    ]
  },
  {
    id: 'monstax',
    name: 'MONSTA X',
    chineseName: '몬스타엑스',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#DC2626',
    desc: 'Muscular performance group blending aggressive hip-hop, sleek pop, and commanding stage presence.',
    songs: [
      ['HERO'], ['Shoot Out'], ['Love Killa'], ['DRAMARAMA'], ['GAMBLER'], ['Beautiful'],
      ['Rush Hour'], ['Jealousy'], ['Alligator'], ['Follow'], ['WHO DO U LOVE?'], ["Someone's Someone"]
    ]
  },
  {
    id: 'day6',
    name: 'DAY6',
    chineseName: '데이식스',
    region: 'region_kr',
    genre: 'genre_rock',
    color: '#0EA5E9',
    desc: 'Singer-songwriter band renowned for emotionally direct lyrics, memorable choruses, and powerful live playing.',
    songs: [
      ['You Were Beautiful'], ['Time of Our Life'], ['Congratulations'], ['HAPPY'],
      ['Welcome to the Show'], ['Shoot Me'], ['Sweet Chaos'], ['Zombie'], ['I Wait'],
      ['days gone by'], ['Melt Down'], ['Love me or Leave me']
    ]
  },
  {
    id: 'psy',
    name: 'PSY',
    chineseName: '鸟叔',
    region: 'region_kr',
    genre: 'genre_dance',
    color: '#FBBF24',
    desc: 'Showman and producer whose comic energy, huge hooks, and viral spectacle brought K-pop to a global audience.',
    songs: [
      ['Gangnam Style'], ['Gentleman'], ['DADDY'], ['That That'], ['New Face'], ['Napal Baji'],
      ['I LUV IT'], ['Celeb'], ['Right Now'], ['Hangover'], ['Korea'], ["It's Art"]
    ]
  },
  {
    id: 'zico',
    name: 'ZICO',
    chineseName: '지코',
    region: 'region_kr',
    genre: 'genre_hiphop',
    color: '#F97316',
    desc: 'Rapper-producer bridging idol pop and Korean hip-hop through precise writing and trend-setting production.',
    songs: [
      ['Any Song'], ['SPOT!'], ['Okey Dokey'], ['Artist'], ['BERMUDA TRIANGLE'], ['New thing'],
      ['Boys and Girls'], ['SoulMate'], ['Freak'], ['Tough Cookie'], ['I Am You, You Are Me'], ["She's a Baby"]
    ]
  },
  {
    id: 'jimin',
    name: 'Jimin',
    chineseName: '朴智旻',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#F59E0B',
    desc: 'BTS vocalist and dancer shaping intimate pop around expressive movement, airy tone, and emotional contrast.',
    itunesArtists: ['Jimin', 'BTS'],
    songs: [
      ['Who'], ['Like Crazy'], ['Set Me Free Pt.2'], ['Smeraldo Garden Marching Band'],
      ['Be Mine'], ['Slow Dance'], ['Rebirth (Intro)'], ['Closer Than This'],
      ['Face-off'], ['Alone'], ['Christmas Love'], ['Promise']
    ]
  },
  {
    id: 'tvxq',
    name: 'TVXQ!',
    chineseName: '东方神起',
    region: 'region_kr',
    genre: 'genre_pop',
    color: '#B91C1C',
    desc: 'Veteran vocal duo whose precision performance and expansive catalog helped establish the Hallyu concert era.',
    searchArtist: 'TVXQ!',
    itunesArtists: ['TVXQ!', 'TVXQ', 'Dong Bang Shin Ki'],
    songs: [
      ['MIROTIC'], ['Rising Sun'], ['Hug'], ['Catch Me'], ['Keep Your Head Down'],
      ['The Chance of Love'], ['Something'], ['Spellbound'], ['Before U Go'],
      ['Love Line'], ['Truth'], ['Rebel']
    ]
  }
];

// Helper to expand Compact Templates into official MusicNode arrays
function generateMusicNodes(): MusicNode[] {
  const nodes: MusicNode[] = [];
  COMPACT_ARTISTS.forEach((artist) => {
    artist.songs.forEach((song, idx) => {
      const [name, chineseName, bpm, key, mood] = song;
      const isSuperstar = idx < 3; // First 3 tracks of each artist represent superstar core tracks (larger stars)
      const id = `song_${artist.id}_${idx + 1}`;
      
      nodes.push({
        id,
        name,
        chineseName,
        type: 'song',
        color: refineColor(artist.color),
        radius: isSuperstar ? 8 : 4.5, // major constellation anchors vs stardust nodes
        region: artist.region,
        genre: artist.genre,
        artist: artist.chineseName ? `${artist.name} / ${artist.chineseName}` : artist.name,
        searchArtist: artist.searchArtist,
        itunesArtists: artist.itunesArtists,
        bpm: bpm || 100,
        key: key || 'C Major',
        mood: mood || 'Chill',
        signatureTrack: name
      });
    });
  });
  return nodes;
}

// Helper to expand Compact Templates into stellar Constellation and Alignment Link filaments
function generateMusicLinks(nodes: MusicNode[]): MusicLink[] {
  const links: MusicLink[] = [];
  const nodesByArtist = new Map<string, MusicNode[]>();

  nodes.forEach((node) => {
    const artistKey = node.id.split('_')[1];
    if (!nodesByArtist.has(artistKey)) {
      nodesByArtist.set(artistKey, []);
    }
    nodesByArtist.get(artistKey)!.push(node);
  });

  // 1. Artist Constellation Filaments: Link every artist's song to their respective top superstars songs
  nodesByArtist.forEach((artistNodes) => {
    const superstarNodes = artistNodes.filter(n => n.radius > 7);
    artistNodes.forEach((node) => {
      superstarNodes.forEach((superstar) => {
        if (node.id !== superstar.id) {
          links.push({
            source: superstar.id,
            target: node.id,
            type: 'created_by',
            strength: 0.85,
            explanation: `"${node.name}" and "${superstar.name}" belong to the same cosmic discography. They share production DNA, signature vocals, and narrative orbits.`
          });
        }
      });
    });
  });

  // 2. Stylistic Bridges: Link songs of different artists that share identical genre and mood
  for (let i = 0; i < nodes.length; i += 7) { // step by 7 to prevent cluttering, keeping links sparse & performant
    const nodeA = nodes[i];
    for (let j = i + 1; j < nodes.length; j += 17) {
      const nodeB = nodes[j];
      const sameArtist = nodeA.id.split('_')[1] === nodeB.id.split('_')[1];
      if (!sameArtist && nodeA.genre === nodeB.genre && nodeA.mood === nodeB.mood) {
        links.push({
          source: nodeA.id,
          target: nodeB.id,
          type: 'stylistically_linked',
          strength: 0.55,
          explanation: `"${nodeA.name}" and "${nodeB.name}" share a stylistic resonance. Fusing similar ${nodeA.genre} rhythms and ${nodeA.mood} atmospheres, they form an interstellar acoustic alignment.`
        });
      }
    }
  }

  // 3. Iconic Cross-over Collaborations (Linking famous crossover songs to each other)
  const manualCollabs = [
    ['song_iu_1', 'song_gd_2', 'Palette G-Dragon rap collaboration'], // IU & G-Dragon: Palette
    ['song_bts_3', 'song_blackpink_3', '3rd Gen Royalty alignment'], // BTS & BLACKPINK
    ['song_newjeans_1', 'song_aespa_5', '4th Gen Cosmic orbit synergy'], // NewJeans & aespa
    ['song_jungkook_1', 'song_jennie_4', 'Global Soloist crossover'], // Jungkook & Jennie
    ['song_lesserafim_5', 'song_twice_3', 'Girlgroup anthems alignment'] // LE SSERAFIM & TWICE
  ];

  manualCollabs.forEach(([idA, idB, label]) => {
    links.push({
      source: idA,
      target: idB,
      type: 'produced_by',
      strength: 0.95,
      explanation: `Historical crossover event: these stars represent the direct collaborative intersection on ${label}.`
    });
  });

  return links;
}

// Generate the primary stellar databases
export const MUSIC_NODES: MusicNode[] = generateMusicNodes();
export const MUSIC_LINKS: MusicLink[] = generateMusicLinks(MUSIC_NODES);
