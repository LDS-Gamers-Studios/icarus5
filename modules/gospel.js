const Augur = require("augurbot");
const { Interaction } = require("discord.js");
const sf = require("../config/snowflakes.json");
const u = require("../utils/utils");

const abbreviationTable = new Map(); // abbreviation: { bookName, work }

const works = {
  "ot": "old-testament",
  "nt": "new-testament",
  "bofm": "book-of-mormon",
  "dc-testament": "doctrine-and-covenants",
  "pogp": "pearl-of-great-price"
};

const manuals = new Map(
  [2022, "old-testament-2022"]
);

/**
 * Builds the abbreviation lookup table for books of scripture.
 * @param {String} bookName The canonical book name. Ex: "Song of Solomon"
 * @param {String[]} abbreviations An array of abbreviations, in lowercase. Ex: ["song", "sos"], ["dc", "d&c"]
 * @param {String} work The abbreviation for the work it's from, according to the Church URL. Ex: "ot", "bofm", "dc-testament"
 * @param {String} urlAbbrev The abbreviation for the chapter in the link. For 1 Nephi, this is 1-ne.
 * @return This method mutates the lookup array.
 */
function refAbbrBuild(bookName, urlAbbrev, work, abbreviations = []) {
  abbreviationTable.set(bookName.toLowerCase(), { bookName, work, urlAbbrev });
  abbreviationTable.set(urlAbbrev.toLowerCase(), { bookName, work, urlAbbrev });
  for (const abbr of abbreviations) {
    abbreviationTable.set(abbr.toLowerCase(), { bookName, work, urlAbbrev });
  }
}

function getScriptureMastery() {
  // TODO
  return { book: "1 Nephi", chapter: 3, verses: "7" };
}

/**
 * Displays a verse that's requested, or a random verse if none is specified.
 * @param {Interaction} interaction The interaction that caused this command.
 */
async function slashGospelVerse(interaction) {
  let book = interaction.options.getString("book", false);
  let chapter = interaction.options.getInteger("chapter", false);
  let verses = interaction.options.getString("verses", false);

  if (!book) {
    // Get a random one from scripture mastery.
    ({ book, chapter, verses } = getScriptureMastery());
  }

  const bookRef = abbreviationTable.get(book.toLowerCase());
  if (!bookRef) {
    interaction.reply({ content: "I don't understand what book you're mentioning.", ephemeral: true });
    return;
  }

  // Parse verses.
  let versesNums;
  if (verses) {
    verses = verses.replace(/ /g, "");
    const versesList = verses.split(",");
    versesNums = new Array();
    const rangeRegex = /(\d+)(?:-(\d+))?/;
    for (const range of versesList) {
      const results = range.match(rangeRegex);
      const low = results[1],
        high = results[2];
      if (!low) {
        interaction.reply({ content: "I don't understand what verses you're looking for.", ephemeral: true });
        return;
      } else if (!high) {
        versesNums.push(parseInt(low));
      } else {
        let lowNum = parseInt(low);
        let highNum = parseInt(high);
        // Swap the range if it's out of order.
        if (lowNum > highNum) {
          [lowNum, highNum] = [highNum, lowNum];
        }
        for (let i = lowNum; i <= highNum; i++) {
          versesNums.push(i);
        }
      }
    }
    // Get unique verses
    versesNums = [...new Set(versesNums)].sort();
  } else { versesNums = []; }
  // Put together the embed
  const embed = u.embed()
    .setTitle(bookRef.bookName + " " + chapter.toString() + (versesNums[0] ? ":" + verses : ""))
    .setURL(`https://www.churchofjesuschrist.org/study/scriptures/${bookRef.work}/${bookRef.urlAbbrev}/${chapter}${(versesNums[0] ? ("." + verses + "?lang=eng#p" + versesNums[0]) : "?lang=eng")}`);
  const bookJson = require("../data/gospel/" + works[bookRef.work] + "-reference.json");
  const verseContent = [];
  for (const num of versesNums) {
    if (bookJson[bookRef.bookName][chapter][num]) {
      verseContent.push(num.toString() + " " + bookJson[bookRef.bookName][chapter][num]);
    }
  }
  embed.setDescription(verseContent.join("\n\n"));
  interaction.reply({ embeds: [embed] });
}

async function slashGospelComeFollowMe(interaction) {
  // Most of this function is old code. Not sure how to improve it.
  let date = new Date();
  date.setHours(0, 0, 0, 0);
  const displayDate = new Date(date);
  let jan1;
  // Account for year-end dates.
  if (date.getMonth() == 11 && (date.getDate() - date.getDay() >= 26)) {
    jan1 = new Date(date.getFullYear() + 1, 0, 1, 0, 0, 0);
    date = jan1;
  } else {
    jan1 = new Date(date.getFullYear(), 0, 1, 0, 0, 0);
  }

  const manual = manuals.get(date.getFullYear());
  if (manual) {
    // Add full weeks and check partial weeks by day of week comparison
    let week = ((date.getDay() + 6) % 7 < (jan1.getDay() + 6) % 7 ? 2 : 1) + Math.floor((date - jan1) / (1000 * 60 * 60 * 24 * 7));
    // Account for General Conference
    if ((date.getMonth() == 3 && (date.getDate() - date.getDay()) >= 0) || date.getMonth() > 3) week -= 1;
    if ((date.getMonth() == 9 && (date.getDate() - date.getDay()) >= 0) || date.getMonth() > 9) week -= 1;

    const link = `https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-individuals-and-families-${manual}/${week.toString().padStart(2, "0")}`;

    // This would be cool as an embed, but I think Discord's built in style is better.
    interaction.reply(`__Come, Follow Me Lesson for the week of ${displayDate.toLocaleDateString()}:__\n${link}`);
  } else {
    interaction.reply({ content:`Sorry, I don't have information for the ${date.getFullYear()} manual yet.`, ephemeral: true });
  }
}

async function slashGospelNews(interaction) {
  // c
  interaction.reply({ content: "to be done lol" });
}

// On module load, load all the abbreviations in.
refAbbrBuild("Genesis", "gen", "ot");
refAbbrBuild("Exodus", "ex", "ot");
refAbbrBuild("Leviticus", "lev", "ot");
refAbbrBuild("Numbers", "num", "ot");
refAbbrBuild("Deuteronomy", "deut", "ot");
refAbbrBuild("Joshua", "josh", "ot");
refAbbrBuild("Judges", "judg", "ot");
refAbbrBuild("Ruth", "ruth", "ot");
refAbbrBuild("1 Samuel", "1-sam", "ot", ["1sam", "1 sam"]);
refAbbrBuild("2 Samuel", "2-sam", "ot", ["2sam", "2 sam"]);
refAbbrBuild("1 Kings", "1-kgs", "ot", ["1kgs", "1 kgs"]);
refAbbrBuild("2 Kings", "2-kgs", "ot", ["2kgs", "2 kgs"]);
refAbbrBuild("1 Chronicles", "1-chr", "ot", ["1chr", "1 chr"]);
refAbbrBuild("2 Chronicles", "2-chr", "ot", ["2chr", "2 chr"]);
refAbbrBuild("Ezra", "ezra", "ot");
refAbbrBuild("Nehemiah", "neh", "ot");
refAbbrBuild("Esther", "esth", "ot");
refAbbrBuild("Job", "job", "ot");
refAbbrBuild("Psalms", "ps", "ot", ["psalm"]);
refAbbrBuild("Proverbs", "prov", "ot");
refAbbrBuild("Ecclesiastes", "eccl", "ot");
refAbbrBuild("Song of Solomon", "song", "ot", ["sos"]);
refAbbrBuild("Isaiah", "isa", "ot");
refAbbrBuild("Jeremiah", "jer", "ot");
refAbbrBuild("Lamentations", "lam", "ot");
refAbbrBuild("Ezekiel", "ezek", "ot");
refAbbrBuild("Daniel", "dan", "ot");
refAbbrBuild("Hosea", "hosea", "ot");
refAbbrBuild("Joel", "joel", "ot");
refAbbrBuild("Amos", "amos", "ot");
refAbbrBuild("Obadiah", "obad", "ot");
refAbbrBuild("Jonah", "jonah", "ot");
refAbbrBuild("Micah", "micah", "ot");
refAbbrBuild("Nahum", "nahum", "ot");
refAbbrBuild("Habakkuk", "hab", "ot");
refAbbrBuild("Zephaniah", "zeph", "ot");
refAbbrBuild("Haggai", "hag", "ot");
refAbbrBuild("Zechariah", "zech", "ot");
refAbbrBuild("Malachi", "mal", "ot");
// New Testament
refAbbrBuild("Matthew", "matt", "nt");
refAbbrBuild("Mark", "mark", "nt");
refAbbrBuild("Luke", "luke", "nt");
refAbbrBuild("John", "john", "nt");
refAbbrBuild("Acts", "acts", "nt");
refAbbrBuild("Romans", "rom", "nt");
refAbbrBuild("1 Corinthians", "1-cor", "nt", ["1cor", "1 cor"]);
refAbbrBuild("2 Corinthians", "2-cor", "nt", ["2cor", "2 cor"]);
refAbbrBuild("Galatians", "gal", "nt");
refAbbrBuild("Ephesians", "eph", "nt");
refAbbrBuild("Philippians", "philip", "nt");
refAbbrBuild("Colossians", "col", "nt");
refAbbrBuild("1 Thessalonians", "1-thes", "nt", ["1thes", "1 thes"]);
refAbbrBuild("2 Thessalonians", "2-thes", "nt", ["2thes", "2 thes"]);
refAbbrBuild("1 Timothy", "1-tim", "nt", ["1tim", "1 tim"]);
refAbbrBuild("2 Timothy", "2-tim", "nt", ["2tim", "2 tim"]);
refAbbrBuild("Titus", "titus", "nt");
refAbbrBuild("Philemon", "philem", "nt");
refAbbrBuild("Hebrews", "heb", "nt");
refAbbrBuild("James", "james", "nt");
refAbbrBuild("1 Peter", "1-pet", "nt", ["1pet", "1 pet"]);
refAbbrBuild("2 Peter", "2-pet", "nt", ["2pet", "2 pet"]);
refAbbrBuild("1 John", "1-jn", "nt", ["1jn", "1john", "1 john"]);
refAbbrBuild("2 John", "2-jn", "nt", ["2jn", "2john", "2 john"]);
refAbbrBuild("3 John", "3-jn", "nt", ["3jn", "3john", "3 john"]);
refAbbrBuild("Jude", "jude", "nt");
refAbbrBuild("Revelation", "rev", "nt", ["revel"]);
// Book of Mormon
refAbbrBuild("1 Nephi", "1-ne", "bofm", ["1ne", "1 ne"]);
refAbbrBuild("2 Nephi", "2-ne", "bofm", ["2ne", "2 ne"]);
refAbbrBuild("Jacob", "jacob", "bofm", ["jac"]);
refAbbrBuild("Enos", "enos", "bofm");
refAbbrBuild("Jarom", "jarom", "bofm");
refAbbrBuild("Omni", "omni", "bofm");
refAbbrBuild("Words of Mormon", "w of m", "bofm", ["wom"]);
refAbbrBuild("Mosiah", "mosiah", "bofm");
refAbbrBuild("Alma", "alma", "bofm");
refAbbrBuild("Helaman", "hel", "bofm");
refAbbrBuild("3 Nephi", "3-ne", "bofm", ["3ne", "3 ne"]);
refAbbrBuild("4 Nephi", "4-ne", "bofm", ["4 ne", "4ne"]);
refAbbrBuild("Mormon", "morm", "bofm");
refAbbrBuild("Ether", "ether", "bofm");
refAbbrBuild("Moroni", "moro", "bofm");
// Doctrine and Covenants
refAbbrBuild("Doctrine & Covenants", "dc", "dc-testament", ["d&c", "d & c", "doctrine and covenants"]);
// Pearl of Great Price
refAbbrBuild("Moses", "moses", "pgp");
refAbbrBuild("Abraham", "abr", "pgp");
refAbbrBuild("Joseph Smith - Matthew", "js-m", "pgp", ["jsm", "joseph smith matthew"]);
refAbbrBuild("Joseph Smith - History", "js-h", "pgp", ["jsh", "joseph smith history"]);
refAbbrBuild("Articles of Faith", "a-of-f", "pgp", ["aof"]);


const Module = new Augur.Module()
  .setInit(() => {
    // init code
  })
  .addInteractionCommand({
    name: "gospel",
    guildId: sf.ldsg,
    commandId: sf.commands.gospel,
    process: async (interaction) => {
      switch (interaction.options.getSubcommand(true)) {
      case "verse":
        await slashGospelVerse(interaction);
        break;
      case "comefollowme":
        await slashGospelComeFollowMe(interaction);
        break;
      case "news":
        await slashGospelNews(interaction);
        break;
      }
    }
  });

module.exports = Module;