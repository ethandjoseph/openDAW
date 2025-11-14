import SftpClient from "ssh2-sftp-client"
import * as fs from "fs"
import {execSync} from "child_process"

const config = {
    host: process.env.SFTP_HOST,
    port: Number(process.env.SFTP_PORT),
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD
} as const

const sftp = new SftpClient()
const distDir = "./packages/app/studio/dist"
const buildInfoPath = "./packages/app/studio/public/build-info.json"

const readBuildInfo = () => JSON.parse(fs.readFileSync(buildInfoPath, "utf8"))

const createRootHtaccess = (releaseDir: string) => `# openDAW
#
# CORS Headers
Header set Access-Control-Allow-Origin "https://localhost:8080"
Header set Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE"
Header set Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With"
Header set Access-Control-Allow-Credentials "true"
Header set Cross-Origin-Opener-Policy "same-origin"
Header set Cross-Origin-Embedder-Policy "require-corp"

RewriteEngine On
RewriteBase /

# --------------------------------------------------
# ACTIVE RELEASE REDIRECT
RewriteRule ^(.*)$ ${releaseDir}/$1 [L]
# --------------------------------------------------
`

;(async () => {
    await sftp.connect(config)

    const {uuid} = readBuildInfo()
    const releaseDir = `/releases/${uuid}`

    console.log("creating", releaseDir)
    await sftp.mkdir(releaseDir, true).catch(() => {})

    // Compress dist directory
    console.log("compressing dist...")
    const tarballPath = "./dist.tar.gz"
    execSync(`tar -czf ${tarballPath} -C ${distDir} .`)

    // Upload the single compressed file
    console.log("uploading compressed dist...")
    const remoteTarball = `${releaseDir}/dist.tar.gz`
    await sftp.put(tarballPath, remoteTarball)

    // Extract on server via PHP
    console.log("extracting on server via PHP...")
    const extractUrl = `https://opendaw.studio/extract.php?file=${encodeURIComponent(remoteTarball)}`
    const extractResponse = await fetch(extractUrl)
    if (!extractResponse.ok) {
        throw new Error(`Extraction failed: ${extractResponse.status} - ${await extractResponse.text()}`)
    }
    console.log(await extractResponse.text())

    // Clean up local tarball
    fs.unlinkSync(tarballPath)

    // Create and upload root .htaccess (redirects to active release)
    const goLive = false
    if (goLive) {
        console.log("creating root .htaccess...")
        const rootHtaccess = createRootHtaccess(releaseDir)
        const tmpFile = "./.htaccess"
        fs.writeFileSync(tmpFile, rootHtaccess)
        await sftp.put(tmpFile, "/.htaccess")
        fs.unlinkSync(tmpFile)
    }

    await sftp.end()
    console.log(`✅ Release uploaded and activated: ${releaseDir}`)

    const webhookUrl = process.env.DISCORD_WEBHOOK
    if (webhookUrl) {
        const now = Math.floor(Date.now() / 1000)
        const content =
            `🚀 **openDAW** deployed <https://opendaw.studio> using release \`${uuid}\` <t:${now}:R>.`
        try {
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({content})
            })
            console.log("Discord:", response.status)
        } catch (err) {
            console.warn("Discord post failed:", err)
        }
    }
})()