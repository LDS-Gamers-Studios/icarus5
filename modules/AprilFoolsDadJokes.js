const Augur = require("augurbot"),
  moment = require("moment"),
  u = require('../utils/utils.js');
const Module = new Augur.Module();

function oddsThingsHappen(percentage) {
  let ran = Math.random();
  if (ran < percentage / 100) return true;
  else return false;
}

const oddsOfGettingDadJoked = 5;

let DadJoke = {

    possibleMatches: [],
    calculateIAmLocation: async (str) => {
        str = " " + str.toLowerCase().replace("-", " ").replace("_", " ");

        //If possible matches is empty, we need to calculate the possible matches. Should only be run on the first usage of the class.
        if (DadJoke.possibleMatches.length < 1) {
            //set up variables
            const selfPronouns = "i, my name".toLowerCase().replace(" ", "").split(",");
            selfPronouns.forEach((pronoun) => pronoun = pronoun.replace(",", ""));

            const beVerbs = [" be", " am", " is", " being", "'m"];

            //handle special patterns
            const specialMatches = "am, im, call me".toLowerCase().replace(" ", "").split(",");
            specialMatches.forEach((match) => {
                match = ` ${match.replace(",", "").trim()} `;
                DadJoke.possibleMatches.push(match);
            });
            //create possbile matches
            for (const verb of beVerbs) {
                for (const pronoun of selfPronouns) {
                    let matchable = ` ${pronoun}${verb} `;
                    await DadJoke.possibleMatches.push(matchable);
                }
            }
        }

        //find all the matches
        for (const possibleMatch of DadJoke.possibleMatches) {
            if (str.indexOf(possibleMatch) > -1) {
                return str.indexOf(possibleMatch) + possibleMatch.length - 1;
            }
        }
        return -1;

    },
    initiate: async (msg) => {

        

        //make sure we should actually dadjoke this person
        if (!oddsThingsHappen(oddsOfGettingDadJoked) || msg.author.bot) { return };
        let imLocation = await DadJoke.calculateIAmLocation(msg.content);
        if (imLocation < 0) return;

        //calculate new dad joke name
        let dadJokeName = msg.content.slice(imLocation).trim();
        dadJokeName = dadJokeName.charAt(0).toUpperCase() + dadJokeName.substr(1, dadJokeName.length);
        let maxLength = 31;

        if (dadJokeName.length > 32) {
            dadJokeName = dadJokeName.slice(0, 32);
        }
        while (dadJokeName.length > maxLength) {
            if (dadJokeName.lastIndexOf(" ") < 0) {
                dadJokeName = dadJokeName.slice(0, maxLength);
            }
            else dadJokeName = dadJokeName.slice(0, dadJokeName.lastIndexOf(" ")).trim();
        }
        try {
            console.log("Hi " + dadJokeName + " I'm Dad!");
            u.clean(msg.channel.send("Hi \"" + dadJokeName + "\" I'm Dad!"));

        } catch (error) {
            u.errorHandler(error);
        }

    }
};

Module.addEvent("messageCreate", (msg) => {
    if(!msg?.author?.bot) return;
    let curDate = moment();
    let date = moment("april 1");
    if (!(date && (date.month() == curDate.month()) && (date.date() == curDate.date()))) return;
    DadJoke.initiate(msg);
    
});
module.exports = Module;
