local profile = dofile("/opt/car.lua")
local base_setup = profile.setup

profile.setup = function()
  local props = base_setup()

  -- Fixed truck dimensions and weight.
  -- These values are used to respect OSM maxheight/maxweight/maxlength restrictions.
  props.vehicle_height = 4.0 -- meters
  props.vehicle_width = 2.6 -- meters
  props.vehicle_length = 15.0 -- meters
  props.vehicle_weight = 40000 -- kilograms (40t)

  return props
end

return profile
