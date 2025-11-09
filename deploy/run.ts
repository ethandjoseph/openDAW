import SftpClient from "ssh2-sftp-client"
import * as fs from "fs"
import * as path from "path"

const config = {
    host: process.env.SFTP_HOST,
    port: Number(process.env.SFTP_PORT),
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD
} as const

const sftp = new SftpClient()
const distDir = "./packages/app/studio/dist"
const buildInfoPath = "./packages/app/studio/public/build-info.json"
const htaccessBasePath = "./packages/app/studio/public/.htaccess"

const readBuildInfo = () => JSON.parse(fs.readFileSync(buildInfoPath, "utf8"))

const uploadDirectory = async (localDir: string, remoteDir: string) => {
        for (const file of fs.readdirSync(localDir)) {
            const localPath = path.join(localDir, file)
            const remotePath = path.posix.join(remoteDir, file)
            const stat = fs.lstatSync(localPath)
            if (stat.isDirectory()) {
                await sftp.mkdir(remotePath, true).catch(() => {})
                await uploadDirectory(localPath, remotePath)
            } else {
                console.log("upload", remotePath)
                await sftp.put(localPath, remotePath)
            }
        }
    }

;(async () => {
    await sftp.connect(config)

    const {uuid, date} = readBuildInfo()
    const releaseDir = `/releases/${uuid}`
    console.log("creating", releaseDir)
    await sftp.mkdir(releaseDir, true).catch(() => {})

    console.log("uploading dist...")
    await uploadDirectory(distDir, releaseDir)

    // merge base .htaccess with redirect block
    const base = fs.readFileSync(htaccessBasePath, "utf8")
    const redirectBlock =
        `\n# --------------------------------------------------\n` +
        `# ACTIVE RELEASE REDIRECT\n` +
        `RewriteRule ^(.*)$ ${releaseDir}/$1 [L]\n` +
        `# --------------------------------------------------\n`
    const merged = base.replace(/^RewriteBase/m, redirectBlock + "RewriteBase") || base + redirectBlock

    const tmpFile = "./.htaccess"
    fs.writeFileSync(tmpFile, merged)
    await sftp.put(tmpFile, "/.htaccess")
    fs.unlinkSync(tmpFile)

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