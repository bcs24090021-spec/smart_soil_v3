# Moisture and air humidity research for V1

## Soil moisture

The 30 VWC ranges in `crop_reference_v1.csv` are transcribed from the user-supplied document, not validated crop requirements. Volumetric water content (VWC) is water volume divided by total soil volume. A fixed VWC range cannot be assumed to mean the same plant-available water across different soils: field capacity and wilting point depend on soil texture. University of Minnesota Extension reports typical field-capacity VWC of about 15-45% and recommends relating a soil sensor's VWC to field capacity and available water, with management-allowed depletion varying by crop and growth stage. Sources: https://extension.umn.edu/natural-resources/conservation/agricultural-soil-and-water/how-agricultural-drainage-works and https://extension.umn.edu/natural-resources/conservation/agricultural-soil-and-water/irrigation/soil-moisture-sensors-for-irrigation-scheduling

FAO 56 uses a crop-specific depletion fraction `p` of total available water, not a universal VWC target. For illustration, its worked example uses `p = 0.30` for onion and `p = 0.55` for maize under the stated conditions. The fraction also changes with atmospheric demand and soil type. These are **depletion fractions, not VWC percentages** and must not replace the CSV's VWC numbers one-for-one. Source: https://www.fao.org/4/x0490e/x0490e0e.htm

The paddy rice row (70-90% VWC) requires priority source/unit review. In flooded rice, standing water depth and soil VWC are distinct measurements. IRRI describes alternate wetting and drying using the field water-table depth and reflooding depth, not a universal 70-90% VWC target. Source: https://www.knowledgebank.irri.org/training/fact-sheets/water-management/saving-water-alternate-wetting-drying-awd

The firmware's `soil_wetness_index` is scaled between two observed ADC readings. It is neither VWC nor a calibrated depletion percentage. Do not compare it with the CSV's `soil_vwc_*_pct` fields or use it to rank crops numerically. To do that later, a defensible measurement/calibration method plus soil-type and field-capacity information would be needed.

## Air humidity

The existing DHT22 firmware already reports ambient `air_humidity_pct` separately from soil wetness. Air humidity affects evapotranspiration: lower humidity generally increases atmospheric water demand; higher humidity generally reduces it. FAO also identifies temperature, sunshine, and wind as important, so one room-air RH reading from a soil sample device is not enough to characterize a field's growing climate. Sources: https://www.fao.org/4/s2022e/s2022e02.htm and https://www.fao.org/4/x0490e/x0490e07.htm

High humidity may also increase disease risk under particular crop/greenhouse conditions; it should not be treated as universally beneficial. Source: https://extension.psu.edu/assessing-the-risk-of-disease-in-greenhouses

V1 decision: display/log DHT22 air RH as a contextual observation with air temperature, but leave crop-specific `air_rh_min_pct` and `air_rh_max_pct` **unset** until a source is found for each crop, production setting, and growth stage. Do not silently use soil VWC ranges as air RH ranges, or penalize/rank crops by an invented RH threshold.
