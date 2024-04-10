import $ from 'jquery';
import { App } from './app';

// __TEST_DRIVER_INJECTION_POINT__

$(document).ready(() => {
  const w = window as any;
  w['pfapp'] = new App();
  w['pfapp'].run();
});
