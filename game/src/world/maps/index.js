// The five environments, by id.
import { mountainValley } from './mountainValley.js';
import { tropicalOcean } from './tropicalOcean.js';
import { militaryAirbase } from './militaryAirbase.js';
import { carrierGroup } from './carrierGroup.js';
import { internationalAirport } from './internationalAirport.js';

export const MAPS = {
  valley: mountainValley,
  tropics: tropicalOcean,
  airbase: militaryAirbase,
  carrier: carrierGroup,
  airport: internationalAirport,
};
