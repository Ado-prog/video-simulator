// Real photographs of the gear, from Wikimedia Commons under free licences (see CREDITS-PHOTOS.md).
// Generated list: file name, author, licence, source page, pixel size.

export type GearPhoto = { src: string; author: string; license: string; page: string; w: number; h: number };

const P = (f: string, author: string, license: string, page: string, w: number, h: number): GearPhoto => ({ src: `./gear/${f}.webp`, author, license, page, w, h });

export const CAMERA_PHOTOS: Record<string, GearPhoto> = {
  "pana-s1ii": P("cam-pana-s1ii", "Mateusz Stopczynski", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Panasonic_LUMIX_S1II_front_view_with_lens.jpg", 440, 293),
  "pana-s1rii": P("cam-pana-s1rii", "Mateusz Stopczynski", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Panasonic_LUMIX_S1RII_front_view_with_lens.jpg", 440, 293),
  "pana-s5ii": P("cam-pana-s5ii", "Henry Söderlund from Helsinki, Finland", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Panasonic_LUMIX_S5_II_(52682131682).jpg", 412, 330),
  "pana-s5iix": P("cam-pana-s5iix", "Mateusz Stopczynski", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Panasonic_LUMIX_S5IIX_front_view_with_lens.jpg", 440, 293),
  "pana-gh7": P("cam-pana-gh7", "Mateusz Stopczynski", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Panasonic_LUMIX_GH7_front_view_with_lens.jpg", 440, 293),
  "pana-gh6": P("cam-pana-gh6", "Peachyeung316", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Panasonic_Lumix_GH6_with_25mm_leica_lens.jpg", 440, 330),
  "pana-g9ii": P("cam-pana-g9ii", "Peachyeung316", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Panasonic_Lumix_G9_II.jpg", 440, 330),
  "sony-a1ii": P("cam-sony-a1ii", "Lunaire - Marc Schoeffel", "CC BY 3.0", "https://commons.wikimedia.org/wiki/File:Photographie_animali%C3%A8re_avec_le_Sony_A1_II_-_Je_suis_BLUFF%C3%89_!_(20250414)-00.00.05.000.png", 440, 247),
  "sony-a9iii": P("cam-sony-a9iii", "昼落ち", "CC0", "https://commons.wikimedia.org/wiki/File:Sony_ILCE-9M3_9_mar_2024c.jpg", 440, 326),
  "sony-a7rv": P("cam-sony-a7rv", "昼落ち", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Sony_%CE%B17R_V_10_dec_2022c.jpg", 418, 330),
  "sony-a7iv": P("cam-sony-a7iv", "Henry Söderlund from Helsinki, Finland, Finland", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Sony_A7_IV_(ILCE-7M4)_-_by_Henry_S%C3%B6derlund_(51739988735).jpg", 440, 293),
  "sony-a7siii": P("cam-sony-a7siii", "昼落ち", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Sony_%CE%B17S_III_21_Oct_2020c.jpg", 440, 326),
  "sony-a7cii": P("cam-sony-a7cii", "Henry Söderlund", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Sony_A7C_II_by_Henry_S%C3%B6derlund.jpg", 440, 293),
  "sony-fx3": P("cam-sony-fx3", "Henry Söderlund from Helsinki, Finland", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Sony_FX3_with_Sony_FE_24mm_F1.4_GM_-_by_Henry_S%C3%B6derlund_(51061907312,_cropped).jpg", 440, 300),
  "sony-zve1": P("cam-sony-zve1", "Henry Söderlund", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Sony_ZV-E1_with_Sony_FE_28-60mm_F4-5.6_-_by_Henry_S%C3%B6derlund_(52854053098).jpg", 440, 293),
  "sony-fx30": P("cam-sony-fx30", "Henry Söderlund from Helsinki, Finland", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Sony_FX30_with_Sony_E_10-20mm_F4_PZ_G_-_by_Henry_S%C3%B6derlund_(52445895581).jpg", 440, 293),
  "canon-r1": P("cam-canon-r1", "昼落ち", "CC0", "https://commons.wikimedia.org/wiki/File:Canon_EOS_R1_12_apr_2025c.jpg", 377, 330),
  "canon-r3": P("cam-canon-r3", "Harrison Jones", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Canon_EOS_R3.jpg", 330, 330),
  "canon-r6ii": P("cam-canon-r6ii", "昼落ち", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Canon_EOS_R6_Mark_II_9_jan_2023d.jpg", 427, 330),
  "canon-r8": P("cam-canon-r8", "Henry Söderlund from Helsinki, Finland", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Canon_EOS_R8_(52853735946).jpg", 440, 293),
  "canon-r7": P("cam-canon-r7", "Dinkun Chen", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Canon_EOS_R7%2BRF-S_18-150mm_f3.5-6.3_IS_STM.jpg", 440, 271),
  "canon-r10": P("cam-canon-r10", "Henry Söderlund from Helsinki, Finland", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Canon_EOS_R10_(52264249766).jpg", 440, 293),
  "canon-r50": P("cam-canon-r50", "SmallSonMarex", "CC0", "https://commons.wikimedia.org/wiki/File:Canon_EOS_R50,_Vorderansicht_30.12.2025.jpg", 440, 330),
  "nikon-z8": P("cam-nikon-z8", "Henry Söderlund from Helsinki, Finland", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Nikon_Z8_(52956802197).jpg", 440, 293),
  "nikon-zf": P("cam-nikon-zf", "昼落ち", "CC0", "https://commons.wikimedia.org/wiki/File:Nikon_Z_f_8_nov_2023b.jpg", 422, 330),
  "nikon-z5ii": P("cam-nikon-z5ii", "TTTNIS", "CC0", "https://commons.wikimedia.org/wiki/File:Nikon_Z5II_01.jpg", 439, 330),
  "nikon-z50ii": P("cam-nikon-z50ii", "昼落ち", "CC0", "https://commons.wikimedia.org/wiki/File:Nikon_Z50II_28_nov_2024a.jpg", 354, 330),
  "nikon-zfc": P("cam-nikon-zfc", "昼落ち", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Nikon_Z_fc_3_aug_2021a.jpg", 402, 330),
  "dji-pocket3": P("cam-dji-pocket3", "Kyu3a", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:DJI_Osmo_Pocket_3_-_2.jpg", 178, 330),
  "dji-action5": P("cam-dji-action5", "Gannu03", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:DJI_Osmo_Action_5_Pro_02.jpg", 440, 293),
  "dji-avata2": P("cam-dji-avata2", "Fumikas Sagisavas", "CC0", "https://commons.wikimedia.org/wiki/File:DJI_AVATA_2_cropped.jpg", 440, 267),
  "dji-neo": P("cam-dji-neo", "Kyu3a", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:DJI_Neo.jpg", 440, 330),
  "dji-mini4pro": P("cam-dji-mini4pro", "Jacek Halicki", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:2024_Dron_DJI_Mini_4_Pro_(01).jpg", 440, 303),
  "dji-mini5pro": P("cam-dji-mini5pro", "Zefke", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:DJI_Mini_5_Pro_in_de_lucht.jpg", 440, 293),
  "dji-air3s": P("cam-dji-air3s", "Jacek Halicki", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:2024_Dron_DJI_Air_3S_(3).jpg", 440, 268),
  "dji-mavic4pro": P("cam-dji-mavic4pro", "Benlisquare", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:DJI_Mavic_4_Pro.jpg", 440, 293),
  "dji-mavic3pro": P("cam-dji-mavic3pro", "A.BourgeoisP", "CC BY 4.0", "https://commons.wikimedia.org/wiki/File:2024-10-_DJI_Mavic_3_Pro_-_26.jpg", 440, 300),
  "insta-x6": P("cam-insta-x6", "PantheraLeo1359531", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:2026-10-04_Frontalaufnahme_Insta360_X6_HOF9321-HDR_RAW-Export_-Staub.png", 178, 330),
  "insta-x5": P("cam-insta-x5", "VlaDexa", "CC BY 4.0", "https://commons.wikimedia.org/wiki/File:Insta360_X5.webp", 220, 330),
  "insta-x4": P("cam-insta-x4", "ItzANormalFioko", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Insta360_X4_senza_protezione_lenti_ma_cover_termica.jpg", 247, 330),
};

export const LENS_PHOTOS: Record<string, GearPhoto> = {
};

export const MIC_PHOTOS: Record<string, GearPhoto> = {
  "rode-wgo2": P("mic-rode-wgo2", "-stk", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Rode_Wireless_Go_II_Set.jpg", 440, 293),
  "senn-mke600": P("mic-senn-mke600", "ParsecAU", "CC0", "https://commons.wikimedia.org/wiki/File:Sennheiser_MKE_600_NoFilter.jpg", 440, 314),
  "nikon-me1": P("mic-nikon-me1", "Jakub T. Jankiewicz", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Nikon_ME-1_Microphone.jpg", 440, 293),
  "shure-movemic": P("mic-shure-movemic", "TaurusEmerald", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Shure_MoveMic_Two_Kit_Wireless_System.jpg", 440, 330),
};
