import urllib.request
import zipfile
import io

url = "https://api.github.com/repos/phantathoang/cam-do-55/actions/jobs/73396276991/logs"
req = urllib.request.Request(url)
# No auth needed for public logs via UI, but API requires auth... wait!
# If API requires auth, I can't download it.
