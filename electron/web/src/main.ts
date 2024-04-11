import $ from 'jquery';
import { App } from './app';

// __TEST_DRIVER_INJECTION_POINT__

$(document).ready(() => {
  const w = window as any;
  w['theapp'] = new App();
  w['theapp'].run();
});
