/**
 * @format
 */

import 'react-native-reanimated';
import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import notifee from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';

notifee.onBackgroundEvent(async () => Promise.resolve());

AppRegistry.registerComponent(appName, () => App);
