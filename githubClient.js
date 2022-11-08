require('dotenv').config()
const { Octokit } = require('octokit')
const base64 = require('base-64')
const { default: axios } = require('axios')
const {retry} = require('./utils') 

const octokit = new Octokit({
  auth: process.env.GH_TOKEN
})

const getSha = async (fileName) => {
  try{
    const res = await octokit.request('Get /repos/{owner}/{repo}/contents/bad-debt/latest/{path}', {
      owner: 'Risk-DAO',
      repo: 'simulation-results',
      path: `${fileName}`,
    })
  return res.data.sha
  } catch (err) {
    return null
  }
}

const getDay = () => {
  const dateObj = new Date();
  const month = dateObj.getUTCMonth() + 1; //months from 1-12
  const day = dateObj.getUTCDate();
  const year = dateObj.getUTCFullYear();
  return day + '.' + month + '.' + year
}

const uploadJsonFile = async (jsonString, fileName, day) => {
  try {
    const sha = await getSha(fileName)
    if(!day){
      await uploadJsonFile(jsonString, fileName, getDay())
    }
    return octokit.request(`PUT /repos/{owner}/{repo}/contents/bad-debt/${day || 'latest'}/{path}`, {
      owner: 'Risk-DAO',
      repo: 'simulation-results',
      path: `${fileName}`,
      message: `bad-debt push ${new Date().toString()}`,
      sha,
      committer: {
        name: process.env.GH_HANDLE,
        email: 'octocat@github.com'
      },
      content: base64.encode(jsonString)
    })
  } catch(err) {
    console.error('failed to upload to github')
    console.error(err)
  }
}

const listJsonFiles = async () => {
  try{
    const res = await octokit.request('Get /repos/{owner}/{repo}/contents/bad-debt/latest', {
      owner: 'Risk-DAO',
      repo: 'simulation-results',
    })
  return res.data.map(o => o.name)
  } catch (err) {
    return []
  }
}

const getJsonFile = async (fileName) => {
  try{
    const {data} = await axios.get(`https://raw.githubusercontent.com/Risk-DAO/simulation-results/main/bad-debt/latest/${encodeURIComponent(fileName)}`)
    return data
  } catch (err) {
    console.error(err)
    return null
  }
}

module.exports = {
  uploadJsonFile: (...arguments) => retry(uploadJsonFile, arguments), 
  listJsonFiles: (...arguments) => retry(listJsonFiles, arguments),
  getJsonFile: (...arguments) => retry(getJsonFile, arguments), 
}