utils = require('./src/utils')

fs = require('fs')
path = require('path')
{spawn, exec, spawnSync} = require('child_process')
wrench = require('wrench')
marked = require('marked')
uglify = require("uglify-js")
browserify = require('browserify')
fileify = require('fileify-lm')
runsync = require('runsync')  # polyfil for node.js 0.12 synchronous running functionality. Remove when upgrading to 0.12

isWindows = (process.platform.lastIndexOf('win') == 0)
runSync2 = (command) ->
  {status, stdout, stderr} = runSyncRaw(command)
  if stderr?.length > 0 or status > 0
    console.error("Error running: '#{command}'\n#{stderr}\n")
    process.exit(status)
  else
    console.log("Output of running '#{command}'\n#{stdout}\n")
    return stdout

runSyncRaw2 = (command) ->
  # Spawn things in a sub-shell so things like io redirection and gsutil work
  if isWindows
    shell = 'cmd.exe'
    args = ['/c', command]
  else
    shell = 'sh'
    args = ['-c', command]
  return spawnSync(shell, args, {encoding: 'utf8'})  # capture the output with `{status, stdout, stderr} = runSyncRaw2(...)`

runSync = (command, options, next) ->
  {stderr, stdout} = runSyncRaw(command, options)
  if stderr.length > 0
    console.error("Error running `#{command}`\n" + stderr)
    process.exit(1)
  if next?
    next(stdout)
  else
    if stdout.length > 0
      console.log("Stdout exec'ing command '#{command}'...\n" + stdout)

runSyncNoExit = (command, options) ->
  {stderr, stdout} = runSyncRaw(command, options)
  console.log("Output of running '#{command}'...\n#{stderr}\n#{stdout}\n")
  return {stderr, stdout}

runSyncRaw = (command, options) ->
  if options? and options.length > 0
    command += ' ' + options.join(' ')
  output = runsync.popen(command)
  stdout = output.stdout.toString()
  stderr = output.stderr.toString()
  return {stderr, stdout}

runAsync = (command, options, next) ->
  if options? and options.length > 0
    command += ' ' + options.join(' ')
  exec(command, (error, stdout, stderr) ->
    if stderr.length > 0
      console.log("Stderr exec'ing command '#{command}'...\n" + stderr)
    if error?
      console.log('exec error: ' + error)
    if next?
      next(stdout)
    else
      if stdout.length > 0
        console.log("Stdout exec'ing command '#{command}'...\n" + stdout)
  )

task('doctest', 'Test examples in documenation.', () ->
  process.chdir(__dirname)
  runSync('coffeedoctest', ['--readme', 'src', 'tzTime.coffee'])
)

task('docs', 'Generate docs with CoffeeDoc and place in ./docs', () ->
  runSync('cake doctest')
  process.chdir(__dirname)
  # create README.html
  readmeDotCSSString = fs.readFileSync('read-me.css', 'utf8')
  readmeDotMDString = fs.readFileSync('README.md', 'utf8')
  readmeDotHTMLString = marked(readmeDotMDString)
  readmeDotHTMLString = """
    <style>
    #{readmeDotCSSString}
    </style>
    <body>
    <div class="readme">
    #{readmeDotHTMLString}
    </div>
    </body>
  """
  fs.writeFileSync(path.join(__dirname, 'docs', 'README.html'), readmeDotHTMLString)

  # jsduckify
  {name, version} = require('./package.json')
  outputDirectory = path.join(__dirname, 'docs', "#{name}-docs")
  if fs.existsSync(outputDirectory)
    wrench.rmdirSyncRecursive(outputDirectory, false)
  runSync('jsduckify', ['-d', "'" + outputDirectory + "'", "'" + __dirname + "'"])
)

task('pub-docs', 'Push master to gh-pages on github', () ->
  invoke('docs')
  pubDocsRaw()
)

pubDocsRaw = () ->
  process.chdir(__dirname)
  runAsync('git push -f origin master:gh-pages')

task('publish', 'Publish to npm', () ->
  process.chdir(__dirname)
  runSync('cake test')  # Doing this exernally to make it synchrous
  invoke('docs')
  invoke('build')
  runSync('git status --porcelain', [], (stdout) ->
    if stdout.length == 0
      {stdout, stderr} = runSyncNoExit('git rev-parse origin/master')
      stdoutOrigin = stdout
      {stdout, stderr} = runSyncNoExit('git rev-parse master')
      stdoutMaster = stdout
      if stdoutOrigin == stdoutMaster
        console.log('running npm publish')
        runSyncNoExit('coffee -c *.coffee src')
        {stdout, stderr} = runSyncNoExit('npm publish .')
        if fs.existsSync('npm-debug.log')
          console.error('`npm publish` failed. See npm-debug.log for details.')
        else
          console.log('running git tag')
          runSyncNoExit("git tag v#{require('./package.json').version}")
          runSyncNoExit("git push --tags")

          pubDocsRaw()

      else
        console.error('Origin and master out of sync. Not publishing.')
    else
      console.error('`git status --porcelain` was not clean. Not publishing.')
  )
)

task('build', 'Build with browserify and place in ./deploy', () ->
  console.log('building...')
  runSync2('cake tz')
  b = browserify()
  b.use(fileify('files', __dirname + '/files'))
  b.ignore(['files'])
  b.require("./tzTime")
  {name, version} = require('./package.json')
  fileString = """
    /*
    #{name} version: #{version}
    */
    #{b.bundle()}
  """
  deployFileName = "deploy/#{name}.js"
  fs.writeFileSync(deployFileName, fileString)

  minFileString = uglify.minify(deployFileName).code
  fs.writeFileSync("deploy/#{name}-min.js", minFileString)
  console.log('done')
  # !TODO: Need to run tests on the built version
)

task('build-and-docs', 'Build and docs combined for LiveReload.', () ->
  invoke('build')
  invoke('docs')
)

task('tz', 'Invokes tz-download then tz-prep.', () ->
  runSync2('cake tz-download')  # Using runSync to make it wait before invoking tz-prep
  invoke('tz-prep')
)

task('tz-download', 'Download latest tz files and unzip them', () ->
  process.chdir(__dirname)
  localFile = 'tzdata-latest.tar.gz'
  if fs.existsSync(localFile)
    fs.unlinkSync(localFile)
  {status, stdout, stderr} = runSyncRaw2('curl -O ftp://ftp.iana.org/tz/tzdata-latest.tar.gz')
  if status > 0
    process.exit(status)
  else
    console.log(stderr)

  outputDirectory = path.join(__dirname, 'vendor', "tz")
  if fs.existsSync(outputDirectory)
    wrench.rmdirSyncRecursive(outputDirectory, false)
  fs.mkdir(outputDirectory)
  {status, stdout, stderr} = runSyncRaw2("tar -zxvf #{localFile} -C vendor/tz")
  if status > 0
    process.exit(status)
  else
    console.log(stderr)

  if fs.existsSync(localFile)
    fs.unlinkSync(localFile)
)

task('tz-prep', 'Prepare the tz files found in vendor/tz for browserify/fileify and place in files/tz.', () ->
 files = [
   'africa',
   'antarctica',
   'asia',
   'australasia',
   'backward',
   'etcetera',
   'europe',
   'northamerica',
   'pacificnew',
   'southamerica',
 ]
 for f in files
   inputFile = 'vendor/tz/' + f
   outputFile = 'files/tz/' + f + '.lzw'
   fileString = fs.readFileSync(inputFile, 'utf8')
   # strip comment lines
   lines = fileString.split('\n')
   outputLines = []
   for line in lines
     commentLocation = line.indexOf('#')
     if commentLocation > 0
       line = line.substr(0, commentLocation)
     while line.substr(line.length - 1) is ' '
       line = line.substr(0, line.length - 1)
     trimmedLine = line.trim()
     if trimmedLine.length > 0 and not utils.startsWith(trimmedLine, '#')
       outputLines.push(line)

   console.log(f, lines.length, outputLines.length)
   outputFileString = outputLines.join('\n')
   output = utils.lzwEncode(outputFileString)
   fs.writeFileSync(outputFile, output, 'utf8')
)

task('test', 'Run the CoffeeScript test suite with nodeunit', () ->
  {reporters} = require('nodeunit')
  process.chdir(__dirname)
  reporters.default.run(['test'], undefined, (failure) ->
    if failure?
      console.error(failure)
      process.exit(1)
  )
)

task('testall', 'Run tests and doctests', () ->
  runSync('cake doctest')
  invoke('test')
)
