require('dotenv').config()
const { Octokit } = require('octokit')
const base64 = require('base-64')
const { default: axios } = require('axios')

const IS_STAGING = process.env.STAGING_ENV && process.env.STAGING_ENV.toLowerCase() == 'true';
const REPO_PATH = IS_STAGING ? 'bad-debt-staging' : 'bad-debt'

const octokit = new Octokit({
  auth: process.env.GH_TOKEN
})

const getSha = async (fileName) => {
  try{
    const res = await octokit.request(`Get /repos/{owner}/{repo}/contents/${REPO_PATH}/latest/{path}`, {
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
  const sha = await getSha(fileName)
  if(!day){
    await uploadJsonFile(jsonString, fileName, getDay())
  }
  return octokit.request(`PUT /repos/{owner}/{repo}/contents/${REPO_PATH}/${day || 'latest'}/{path}`, {
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
}

const listJsonFiles = async () => {
  try{
    const res = await octokit.request(`Get /repos/{owner}/{repo}/contents/${REPO_PATH}/latest`, {
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
    const {data} = await axios.get(`https://raw.githubusercontent.com/Risk-DAO/simulation-results/main/${REPO_PATH}/latest/${encodeURIComponent(fileName)}`)
    return data
  } catch (err) {
    console.error(err)
    return null
  }
}

module.exports = {
  uploadJsonFile, 
  listJsonFiles,
  getJsonFile, 
}