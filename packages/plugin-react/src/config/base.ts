
import { join } from 'path'
import { Mode } from 'ssr-types'
import { getFeDir, getCwd, loadConfig, getLocalNodeModules, setStyle } from 'ssr-server-utils'
import * as WebpackChain from 'webpack-chain'

const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const WebpackBar = require('webpackbar')
const loadModule = require.resolve

const getBaseConfig = (chain: WebpackChain, isServer: boolean) => {
  const config = loadConfig()
  const { moduleFileExtensions, useHash, isDev, cssModulesWhiteList, chainBaseConfig, corejs } = config
  const mode = process.env.NODE_ENV as Mode
  const envOptions = {
    modules: false
  }

  if (corejs) {
    Object.assign(envOptions, {
      corejs: {
        version: 3,
        proposals: true
      },
      useBuiltIns: 'usage'
    })
  }
  chain.mode(mode)
  chain.module.strictExportPresence(true)
  chain
    .resolve
    .modules
    .add('node_modules')
    .add(join(getCwd(), './node_modules'))
    .when(isDev, chain => {
      chain.add(getLocalNodeModules())
    })
    .end()
    .extensions.merge(moduleFileExtensions)
    .end()
    .alias
    .end()
  chain.resolve.alias
    .set('@', getFeDir())
    .set('react', loadModule('react')) // 用cwd的路径alias，否则可能会出现多个react实例
    .set('react-router', loadModule('react-router'))
    .set('react-router-dom', loadModule('react-router-dom'))
  chain.module
    .rule('images')
    .test(/\.(jpe?g|png|svg|gif)(\?[a-z0-9=.]+)?$/)
    .use('url-loader')
    .loader(loadModule('url-loader'))
    .options({
      limit: 10000,
      name: '[name].[hash:8].[ext]',
      // require 图片的时候不用加 .default
      esModule: false,
      fallback: {
        loader: loadModule('file-loader'),
        options: {
          publicPath: '/client/images',
          name: '[name].[hash:8].[ext]',
          esModule: false,
          outputPath: 'images'
        }
      }
    })
    .end()

  chain.module
    .rule('compile')
    .test(/\.(js|mjs|jsx|ts|tsx)$/)
    .exclude
    .add(/node_modules/)
    .end()
    .use('babel-loader')
    .loader(loadModule('babel-loader'))
    .options({
      cacheDirectory: true,
      cacheCompression: false,
      sourceType: 'unambiguous',
      presets: [
        [
          loadModule('@babel/preset-env'),
          envOptions
        ],
        [loadModule('babel-preset-react-app'), { flow: false, typescript: true }]
      ],
      plugins: [
        [loadModule('@babel/plugin-transform-runtime'), {
          regenerator: false,
          corejs: false,
          helpers: true
        }],
        [
          loadModule('babel-plugin-import'),
          {
            libraryName: 'antd',
            libraryDirectory: 'lib',
            style: true
          }
        ],
        [loadModule('@babel/plugin-proposal-private-methods'), { loose: true }]
      ]
    })
    .end()

  setStyle(isDev, chain, /\.css$/, {
    exclude: cssModulesWhiteList,
    rule: 'css',
    modules: true,
    importLoaders: 1
  }, true) // 设置css

  setStyle(isDev, chain, /\.less$/, {
    exclude: cssModulesWhiteList,
    rule: 'less',
    loader: 'less-loader',
    modules: true,
    importLoaders: 2
  }, true)

  setStyle(isDev, chain, /\.less$/, {
    include: cssModulesWhiteList,
    rule: 'cssModulesWhiteListLess',
    modules: false,
    loader: 'less-loader',
    importLoaders: 2
  }, true) // 默认 antd swiper 不使用 css-modules，建议第三方 ui 库都不使用

  setStyle(isDev, chain, /\.css$/, {
    include: cssModulesWhiteList,
    rule: 'cssModulesWhiteListCss',
    modules: false,
    importLoaders: 1
  }, true)

  chain.module
    .rule('svg')
    .test(/\.(svg)(\?.*)?$/)
    .use('file-loader')
    .loader(loadModule('file-loader'))
    .options({
      name: 'static/[name].[hash:8].[ext]',
      esModule: false
    })
    .end()

  chain.module
    .rule('fonts')
    .test(/\.(eot|woff|woff2|ttf)(\?.*)?$/)
    .use('file-loader')
    .loader(loadModule('file-loader'))
    .options({
      name: 'static/[name].[hash:8].[ext]',
      esModule: false
    })

  chain.plugin('minify-css').use(MiniCssExtractPlugin, [{
    filename: useHash ? 'static/css/[name].[contenthash:8].css' : 'static/css/[name].css',
    chunkFilename: useHash ? 'static/css/[name].[contenthash:8].chunk.css' : 'static/css/[name].chunk.css'
  }])

  chain.plugin('webpackBar').use(new WebpackBar({
    name: isServer ? 'server' : 'client',
    color: isServer ? '#f173ac' : '#45b97c'
  }))

  chainBaseConfig(chain)
  return config
}

export {
  getBaseConfig
}
