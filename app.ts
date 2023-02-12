/**
 * app.ts
 *
 * function：Node.js server
 **/

'use strict';

// constants
const DEF_NETKEIBA_URL: string = 'https://netkeiba.com'; // base url
const DEF_TRAINING_URL: string = 'https://race.netkeiba.com/race/oikiri.html?race_id='; // training page url
const DEF_URL_QUERY: string = '&type=2&rf=shutuba_submenu'; // query
const OUTPUT_PATH: string = './public/output/'; // output path

// import modules
import * as fs from 'fs'; // fs
import * as dotenv from 'dotenv'; // dotenc
dotenv.config(); // dotenv
import { Scrape } from './class/myScraper'; // scraper
import { Aggregate } from './class/myAggregator'; // aggregator

// active course ID
const activeId: string = '202205040501';
const activeCourseName: string = '東京';

// netkeiba id
const netKeibaId: string = process.env.NETKEIBA_ID ?? '';
// netkeiba pass
const netKeibaPass: string = process.env.NETKEIBA_PASS ?? '';
// header
const sheetTitleArray: string[][] = [
  ['馬名', '実施日', '競馬場', '馬場状態', '強さ', 'レビュー']
];

// make empty xlsx
const makeEmptyXlsx = (filePath: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const promise1: Promise<void> = new Promise(async (resolve) => {
        // if file exists
        if (fs.existsSync(filePath)) {
          // delete file
          fs.unlink(filePath, (err: unknown) => {
            if (err) throw err;
            console.log('File is deleted successfully.');
            // resolved
            resolve();
          });
        } else {
          // resolved
          resolve();
        }
      });
      const promise2: Promise<void> = new Promise(async (resolve) => {
        // create empty file
        fs.writeFile(filePath, '', (err: unknown) => {
          if (err) throw err;
          console.log('File is created successfully.');
        });
        // resolved
        resolve();
      });
      Promise.all([promise1, promise2]).then((): void => {
        // resolved
        resolve();
      });
    } catch (e: unknown) {
      // error
      console.log(e);
      // reject
      reject(e);
    }
  });
}

// scraper
const scraper = new Scrape();

// aggregator
const aggregator = new Aggregate();

// main
(async (): Promise<void> => {
  try {
    // course
    const targetCourse: string = activeId.slice(0, -2);
    // filename
    const fileName: string = (new Date).toISOString().replace(/[^\d]/g, "").slice(0, 14);
    // base url
    const baseUrl: string = `${DEF_TRAINING_URL}${targetCourse}`;
    // csv filename
    const filePath: string = `${OUTPUT_PATH}${activeCourseName}-${fileName}.xlsx`;
    // initialize
    await scraper.init();
    // goto netkeiba
    await scraper.doGo(DEF_NETKEIBA_URL);
    // wait for loading of login button
    await scraper.doWaitSelector('.Icon_Login', 50000);
    // click login
    await scraper.doClick('.Icon_Login');
    // wait for id/pass input
    await scraper.doWaitSelector('input[name="login_id"]', 10000);
    // input id
    await scraper.doType('input[name="login_id"]', netKeibaId);
    // input pass
    await scraper.doType('input[name="pswd"]', netKeibaPass);
    // wait 3 sec
    await scraper.doWaitFor(3000);
    // click login button
    await scraper.doClick('.loginBtn__wrap input');
    // wait 3 sec
    await scraper.doWaitFor(3000);
    // make empty csv
    await makeEmptyXlsx(filePath);
    // init
    await aggregator.init(filePath);
    // loop each races
    for (let j: number = 1; j <= 12; j++) {
      // post array
      let postArray: string[][] = [];
      // race
      const raceName: string = `${activeCourseName}${j}R`;
      // url
      const targetUrl: string = `${baseUrl}${String(j).padStart(2, '0')}${DEF_URL_QUERY}`;
      // goto site
      await scraper.doGo(targetUrl);
      // wait for datalist
      await scraper.doWaitSelector('.Horse_Info', 10000);
      // loop each horses
      for (let i: number = 1; i <= 18; i++) {
        Promise.all([
          // horse name
          scraper.doSingleEval(`.OikiriDataHead${i} .Horse_Info .Horse_Name a`, 'innerHTML'),
          // date
          scraper.doSingleEval(`.OikiriDataHead${i} .Training_Day`, 'innerHTML'),
          // place
          scraper.doSingleEval(`.OikiriDataHead${i} td:nth-child(6)`, 'innerHTML'),
          // condition
          scraper.doSingleEval(`.OikiriDataHead${i} td:nth-child(7)`, 'innerHTML'),
          // training speed
          scraper.doSingleEval(`.OikiriDataHead${i} td:nth-child(11)`, 'innerHTML'),
          // training evaluation
          scraper.doSingleEval(`.OikiriDataHead${i} td:nth-child(12)`, 'innerHTML'),
        ]).then((array1: string[]): void => {
          // push results
          postArray.push(array1);
        });
        // rap time
        const rapTimes: string[] = await scraper.doMultiEval(`.OikiriDataHead${i} .TrainingTimeDataList li .RapTime`, 'innerHTML');
        // push results
        postArray.push(rapTimes);
        // cell color
        await scraper.doMultiEval(`.OikiriDataHead${i} .TrainingTimeDataList li`, 'className')
          .then((array2: string[]): void => {
            // push results
            postArray.push(array2);
          });
        // wait 0.5 sec
        await scraper.doWaitFor(500);
      }
      // push data
      await aggregator.writeData(sheetTitleArray, postArray, raceName);
      // wait 0.5 sec
      await scraper.doWaitFor(500);
      // close browser
      console.log(`${raceName} finished`);
    }
    // make csv
    await aggregator.makeCsv(filePath);
    // close browser
    await scraper.doClose();
    console.log(`${filePath} finished`);
    
  } catch (e: unknown) {
    // error
    console.log(e);
  }
})();
