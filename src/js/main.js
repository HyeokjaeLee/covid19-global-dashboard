const today = new Date();
const chartLoading = document.getElementById("chartLoading");
const toLocalString = (number) =>
  number != null ? number.toLocaleString() : number;
/**dynamic element들의 기준이 되는 정보*/
const target = {
  region: "Total",
  startDate: 0,
  endDate: convert_date(today),
};

const main = (() => {
  create_static_elements();
  create_dynamic_elements(target.region, target.startDate, target.endDate);
})();

/*사용할 함수 선언*/

function change_data(_target) {
  chartLoading.style.display = "block";
  if (typeof _target === "string") target.region = _target;
  else
    target.startDate = !!_target ? convert_date(minus_date(today, _target)) : 0;
  create_dynamic_elements(target.region, target.startDate, target.endDate);
}

/**정적 데이터를 사용하는 element 업데이트
 * 첫 페이지 로딩시에만 호출
 */
function create_static_elements() {
  const startDate = convert_date(minus_date(today, 8));
  const endDate = convert_date(today);
  const query = `query{
    regionalDataList(startDate:${startDate} endDate:${endDate}){
      regionEng
      regionKor
      population
      distancingLevel
      covid19DataList{
        date
        confirmed{
          total
        }
        quarantine{
          total
          new{
            domestic
            overseas
            total
          }
        }
        vaccinated{
          first{
            total
          }
          second{
            total
          }
        }
        per100kConfirmed
        immunityRatio
      }
    }
  }`;
  covid19_API(query, (regionalDataList) => {
    /**element를 생성하는 필요한 데이터 공간*/
    const elementData = {
      regionList: [],
      per100kConfirmedList: [],
      immunityRatio: [],
      newQuarantineList: {
        total: [],
        domestic: [],
        overseas: [],
      },
      vaccinatedList: {
        first: [],
        second: [],
      },
      per100kAverage: [],
    };
    const newConfirmedCase_per100k = [];
    const regionCount = regionalDataList.length;
    const regionList_ul = document.getElementById("list");
    const estimatedIncreasingList = document.getElementById(
      "estimatedIncreasingList"
    );
    const estimatedDecreasingList = document.getElementById(
      "estimatedDecreasingList"
    );

    /**인구 10만명당 대상 수
     * @param num 대상 수
     * @param population 인구 수
     * @returns 10만명당 수
     */
    const count_per100k = (num, population) =>
      Math.round(num * (100000 / population) * 100) / 100;

    /**데이터를 분류하고 동시에 지역 List element를 생성하기 위한 루프*/
    regionalDataList.forEach((regionalData) => {
      const covid19Data = regionalData.covid19DataList;
      const lastCovid19Data = covid19Data[covid19Data.length - 1];

      //지역 리스트 생성
      const regionList_li = document.createElement("li");
      regionList_li.setAttribute("id", regionalData.regionEng);
      const regionName = regionalData.regionKor;
      const distancingLevel =
        regionName != "검역" ? regionalData.distancingLevel + " 단계" : "Null";
      regionList_li.setAttribute(
        "onClick",
        `change_data("${regionalData.regionEng}"); location.href='#regionChartsLine'`
      );
      //수치 상으로는 일치하지만 마지막 li의 오른쪽 여백이 살짝 부족한것 처럼 느껴저서 2px를 더해줌
      regionList_li.innerHTML = `
        <ul class="list_item">
          <li>${regionalData.regionKor}</li>
          <li>${toLocalString(lastCovid19Data.quarantine.new.total)}</li>
          <li>${toLocalString(lastCovid19Data.confirmed.total)}</li>
          <li style="padding-right:2px">${distancingLevel}</li>
        </ul>`;
      regionList_ul.appendChild(regionList_li);

      //사용할 데이터 분류
      {
        newConfirmedCase_per100k.push(
          count_per100k(
            lastCovid19Data.quarantine.new.total,
            regionalData.population
          )
        );
        elementData.regionList.push(regionalData.regionKor);
        elementData.per100kConfirmedList.push(lastCovid19Data.per100kConfirmed);
        elementData.immunityRatio.push(lastCovid19Data.immunityRatio);
        elementData.newQuarantineList.domestic.push(
          lastCovid19Data.quarantine.new.domestic
        );
        elementData.newQuarantineList.overseas.push(
          lastCovid19Data.quarantine.new.overseas
        );
        elementData.vaccinatedList.first.push(
          lastCovid19Data.vaccinated.first.total
        );
        elementData.vaccinatedList.second.push(
          lastCovid19Data.vaccinated.second.total
        );
      }

      /**몇몇 chart는 지역 구분 '전국', '검역'을 사용하지 않음
       * @index0 전국
       * @index18 검역
       */
      if (
        regionalData.regionKor != "검역" &&
        regionalData.regionKor != "전국"
      ) {
        const last7daysCovid19DataList = covid19Data.slice(-7);
        const quarantineNewTotalList = last7daysCovid19DataList.map(
          (covid19Data) => covid19Data.quarantine.new.total
        );
        const sum = quarantineNewTotalList.reduce(
          (sum, currValue) => sum + currValue,
          0
        );
        const average = sum / quarantineNewTotalList.length;
        const per100kAverage = count_per100k(average, regionalData.population);
        elementData.per100kAverage.push(per100kAverage);
        const estimatedDistancingLv =
          per100kAverage >= 4
            ? 4
            : per100kAverage >= 2
            ? 3
            : per100kAverage >= 1
            ? 2
            : 1;
        const differenceEstimatedDistancingLv =
            estimatedDistancingLv - regionalData.distancingLevel,
          differenceEstimatedDistancingLvText =
            differenceEstimatedDistancingLv > 0
              ? "+" + differenceEstimatedDistancingLv
              : differenceEstimatedDistancingLv;
        //todo
        const li = document.createElement("li");
        const span = document.createElement("span");
        li.append(
          `${regionalData.regionKor}: ${distancingLevel} > ${estimatedDistancingLv} 단계`
        );
        span.append(differenceEstimatedDistancingLvText);
        li.append(span);
        if (differenceEstimatedDistancingLv < 0) {
          estimatedDecreasingList.append(li);
        } else if (differenceEstimatedDistancingLv > 0) {
          estimatedIncreasingList.append(li);
        }
      }
    });
    //차트 생성
    {
      /**누적 확진자(10만명당) 차트*/
      const per100k_chart = c3.generate({
        bindto: "#per100k_chart",
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
        data: {
          json: {
            region: elementData.regionList.slice(1, 18),
            확진: elementData.per100kConfirmedList.slice(1, 18),
          },
          x: "region",
          type: "bar",
          colors: { 확진: "#353942" },
          color: (color, d) =>
            d.value >= elementData.per100kConfirmedList[0] ? "#e7604a" : color,
        },
        legend: {
          hide: true,
        },
        axis: {
          x: {
            show: true,
            type: "category",
          },
          y: {
            show: false,
            tick: {
              format: (d) => toLocalString(d) + " 명",
            },
          },
        },
        grid: {
          y: {
            lines: [
              {
                value: elementData.per100kConfirmedList[0],
                text: `전국 ${elementData.per100kConfirmedList[0]}명`,
              },
            ],
          },
        },
        point: {
          show: false,
        },
        point: {
          show: false,
        },
      });

      const newConfirmedCase_per100k_chart = c3.generate({
        bindto: "#newConfirmedCase_per100k_chart",
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
        data: {
          json: {
            region: elementData.regionList.slice(1, 18),
            확진: newConfirmedCase_per100k.slice(1, 18),
          },
          x: "region",
          type: "bar",
          colors: { 확진: "#353942" },
          color: (color, d) =>
            d.value >= newConfirmedCase_per100k[0] ? "#e7604a" : color,
        },
        legend: {
          hide: true,
        },
        axis: {
          x: {
            show: true,
            type: "category",
          },
          y: {
            show: false,
            tick: {
              format: (d) => toLocalString(d) + " 명",
            },
          },
        },
        grid: {
          y: {
            lines: [
              {
                value: newConfirmedCase_per100k[0],
                text: `전국 ${newConfirmedCase_per100k[0]}명`,
              },
            ],
          },
        },
        point: {
          show: false,
        },
        point: {
          show: false,
        },
      });

      /**신규 격리 차트*/
      const newQuarantine_chart = c3.generate({
        bindto: "#newQuarantine_chart",
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
        data: {
          json: {
            region: elementData.regionList.slice(1, 18),
            해외: elementData.newQuarantineList.overseas.slice(1, 18),
            국내: elementData.newQuarantineList.domestic.slice(1, 18),
          },
          x: "region",
          type: "bar",
          groups: [["해외", "국내"]],
          colors: { 해외: "#e7604a", 국내: "#353942" },
        },
        axis: {
          x: {
            show: true,
            type: "category",
          },
          y: {
            show: false,
            tick: {
              format: (d) => toLocalString(d) + " 명",
            },
          },
        },
        point: {
          show: false,
        },
      });
      //백신 접종 차트
      c3.generate({
        bindto: "#vaccinated_chart",
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
        data: {
          json: {
            region: elementData.regionList.slice(1, 18),
            "1차 접종": elementData.vaccinatedList.first.slice(1, 18),
            "2차 접종": elementData.vaccinatedList.second.slice(1, 18),
          },
          x: "region",
          type: "bar",
          colors: { "1차 접종": "#2cabb1", "2차 접종": "#29c7ca" },
        },
        axis: {
          x: {
            show: true,
            type: "category",
          },
          y: {
            show: false,
            tick: {
              format: (d) => toLocalString(d) + " 명",
            },
          },
        },
        point: {
          show: false,
        },
      });
      //면역 비율 차트
      c3.generate({
        bindto: "#immunityRatio_chart",
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
        data: {
          json: {
            region: elementData.regionList.slice(1, 18),
            "면역 비율": elementData.immunityRatio.slice(1, 18),
          },
          x: "region",
          type: "bar",
          colors: { "면역 비율": "#29c7ca" },
        },
        axis: {
          x: {
            show: true,
            type: "category",
          },
          y: {
            max: 0.8,
            show: false,
            tick: {
              format: d3.format(".1%"),
            },
          },
        },
        grid: {
          y: {
            lines: [
              {
                value: 0.7,
                text: `집단면역 70%`,
              },
            ],
          },
        },
        point: {
          show: false,
        },
      });

      c3.generate({
        bindto: "#per100k_7d_chart",
        padding: { left: 25, right: 25, top: 10, bottom: 10 },
        data: {
          json: {
            region: elementData.regionList.slice(1, 18),
            확진: elementData.per100kAverage,
          },
          x: "region",
          type: "bar",
          colors: { 확진: "#2CABB1" },
          color: (color, d) =>
            d.value >= 4 ? "#e7604a" : d.value >= 1 ? "#353942" : color,
        },
        legend: {
          hide: true,
        },
        axis: {
          x: {
            show: true,
            type: "category",
          },

          y: {
            show: true,
            tick: {
              outer: false,
              values: [1, 2, 4],
              format: (d) => toLocalString(d) + " 명",
            },
          },
        },
        grid: {
          y: {
            lines: [
              {
                value: 1,
                text: "거리두기 2단계",
                class: "distancingLevelLine",
              },
              {
                value: 2,
                text: "거리두기 3단계",
                class: "distancingLevelLine",
              },
              {
                value: 4,
                text: "거리두기 4단계",
                class: "distancingLevelLine",
              },
            ],
          },
        },
      });
    }
    const updatedDate = document.getElementById("updatedDate");
    updatedDate.innerHTML = `Update: ${
      regionalDataList[0].covid19DataList[
        regionalDataList[0].covid19DataList.length - 1
      ].date
    }`;
  });
}

function create_dynamic_elements(region, startDate, endDate) {
  const query = `query{
  regionalDataList(region:${region} startDate:${startDate} endDate:${endDate}){
    regionEng
    regionKor
    population
    covid19DataList{
      date
      confirmed{
        total
        accumlated
      }
      quarantine{
        total
        new{
          total
          domestic
          overseas
        }
      }
      recovered{
        total
        new
        accumlated
      }
      dead{
        total
        new
        accumlated
      }
      vaccinated{
        first{
          total
          new
          accumlated
        }
        second{
          total
          new
          accumlated
        }
      }
      per100kConfirmed
      immunityRatio
    }
  }
}`;
  const lazarettoVaccinationText =
    "해당지역은 백신 접종 정보를<br>제공하지 않습니다.";
  covid19_API(query, (regionalDataList) => {
    const covid19DataList = regionalDataList[0].covid19DataList;
    const lastData = covid19DataList[covid19DataList.length - 1];
    const elementData = {
      date: [],
      confirmed_total: [],
      confirmed_accumlated: [],
      quarantine_total: [],
      quarantine_new_total: [],
      quarantine_new_domestic: [],
      quarantine_new_overseas: [],
      dead_new: [],
      dead_accumlated: [],
      recovered_total: [],
      vaccinated_first_new: [],
      vaccinated_second_new: [],
      vaccinated_first_total: [],
      vaccinated_second_total: [],
    };
    covid19DataList.forEach((covid19Data) => {
      elementData.date.push(covid19Data.date);
      elementData.confirmed_total.push(covid19Data.confirmed.total);
      elementData.confirmed_accumlated.push(covid19Data.confirmed.accumlated);
      elementData.quarantine_total.push(covid19Data.quarantine.total);
      elementData.quarantine_new_total.push(covid19Data.quarantine.new.total);
      elementData.quarantine_new_domestic.push(
        covid19Data.quarantine.new.domestic
      );
      elementData.quarantine_new_overseas.push(
        covid19Data.quarantine.new.overseas
      );
      elementData.recovered_total.push(covid19Data.recovered.total);
      elementData.dead_new.push(covid19Data.dead.new);
      elementData.dead_accumlated.push(covid19Data.dead.accumlated);
      elementData.vaccinated_first_total.push(
        covid19Data.vaccinated.first.total
      );
      elementData.vaccinated_second_total.push(
        covid19Data.vaccinated.second.total
      );
      elementData.vaccinated_first_new.push(covid19Data.vaccinated.first.new);
      elementData.vaccinated_second_new.push(covid19Data.vaccinated.second.new);
    });
    //지역 상세 정보 생성
    {
      const region_info = document.getElementById("region_info");
      region_info.innerHTML = `
    <div>${regionalDataList[0].regionKor} 상세정보</div>
    <br>
    <table>
      <thead>
        <tr>
          <th>구분</th>
          <th colspan='3'>격리자</th>
          <th>회복자</th>
          <th>사망자</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td rowspan='2'>신규</td>
          <td rowspan='2'>${toLocalString(
            lastData.quarantine.new.total
          )} 명</td>
          <td>해외</td>
          <td>${toLocalString(lastData.quarantine.new.overseas)} 명</td>
          <td rowspan='2'>${toLocalString(lastData.recovered.new)} 명</td>
          <td rowspan='2'>${toLocalString(lastData.dead.new)} 명</td>
        </tr>
        <tr>
          <td>국내</td>
          <td>${toLocalString(lastData.quarantine.new.domestic)} 명</td>
        </tr>
        <tr>
          <td>누적</td>
          <td colspan='3'>(확진) ${toLocalString(
            lastData.confirmed.accumlated
          )} 명</td>
          <td>${toLocalString(lastData.recovered.accumlated)} 명</td>
          <td>${toLocalString(lastData.dead.accumlated)} 명</td>
        </tr>
        <tr>
          <td>전체</td>
          <td colspan='3'>${toLocalString(lastData.quarantine.total)} 명</td>
          <td>${toLocalString(lastData.recovered.total)} 명</td>
          <td>${toLocalString(lastData.dead.total)} 명</td>
        </tr>
        <tr>
          <td>총 확진자</td>
          <td colspan='5'>${toLocalString(lastData.confirmed.total)} 명</td>
        </tr>
      </tbody>
    </table>
    `;
    }
    //차트 생성
    {
      const axisXcount =
        elementData.date.length < 30 ? elementData.date.length : 30;
      //확진자 비율 차트
      c3.generate({
        bindto: "#confirmedRatio_chart",
        data: {
          columns: [
            ["격리", lastData.quarantine.total],
            ["사망", lastData.dead.total],
            ["회복", lastData.recovered.total],
          ],
          type: "donut",
          colors: {
            사망: "#353942",
            회복: "#29c7ca",
            격리: "#ff8151",
          },
          labels: {
            format: {
              y: d3.format(".1%"),
            },
          },
        },
        donut: {
          expand: false,
          title: "확진자 상태 비율",
        },
        axis: {
          x: {
            type: "categorized",
          },
        },
      });
      //집단 면역 비율 차트

      if (regionalDataList[0].regionKor === "검역") {
        const first_vaccination = document.getElementById("first_vaccination");
        const second_vaccination =
          document.getElementById("second_vaccination");
        const second_vaccinationRate_chart = document.getElementById(
          "second_vaccinationRate_chart"
        );
        const newVaccination_chart = document.getElementById(
          "newVaccination_chart"
        );
        const cumulativeVaccination_chart = document.getElementById(
          "cumulativeVaccination_chart"
        );
        second_vaccinationRate_chart.innerHTML = "";
        newVaccination_chart.innerHTML = `<br><br><br>${lazarettoVaccinationText}`;
        cumulativeVaccination_chart.innerHTML = `<br><br><br>${lazarettoVaccinationText}`;
        first_vaccination.innerHTML = "검역";
        second_vaccination.innerHTML = lazarettoVaccinationText;
      } else {
        const lastVaccinatedFirstTotal =
          elementData.vaccinated_first_total[
            elementData.vaccinated_first_total.length - 1
          ];
        const lastVaccinatedSecondTotal =
          elementData.vaccinated_second_total[
            elementData.vaccinated_second_total.length - 1
          ];

        first_vaccination.innerHTML = `1차 백신 접종: ${toLocalString(
          lastVaccinatedFirstTotal
        )} 명`;
        second_vaccination.innerHTML = `2차 백신 접종: ${toLocalString(
          lastVaccinatedSecondTotal
        )} 명`;

        const second_vaccinationRate_chart = c3.generate({
          bindto: "#second_vaccinationRate_chart",
          data: {
            columns: [["면역자 비율", lastVaccinatedSecondTotal]],
            type: "gauge",
          },
          gauge: {
            max: regionalDataList[0].population,
            expand: false,
            label: {
              show: false,
            },
          },
          tooltip: {
            show: false,
          },
        });

        let nonNullIndex;
        elementData.vaccinated_first_new.some((vaccinedFirstNew, index) => {
          if (vaccinedFirstNew != null) {
            nonNullIndex = index;
            return true;
          }
        });
        /**신규 백신접종 추이 차트*/
        const newVaccination_chart = c3.generate({
          bindto: "#newVaccination_chart",
          padding: { left: 20, right: 20, top: 10, bottom: 10 },
          data: {
            json: {
              date: elementData.date.slice(nonNullIndex),
              "1차 접종": elementData.vaccinated_first_new.slice(nonNullIndex),
              "2차 접종": elementData.vaccinated_second_new.slice(nonNullIndex),
            },
            x: "date",
            type: "area-spline",
            colors: {
              "1차 접종": "#29C7CA",
              "2차 접종": "#2CABB1",
            },
          },
          axis: {
            x: {
              show: true,
              type: "timeseries",
              tick: {
                format: "%y.%m.%d",
                fit: true,
                outer: false,
                count: axisXcount,
              },
            },
            y: {
              show: false,
              tick: {
                format: (d) => toLocalString(d) + " 명",
              },
            },
          },

          point: {
            show: false,
          },
        });

        /**누적 백신접종 추이 차트*/
        const cumulativeVaccination_chart = c3.generate({
          bindto: "#cumulativeVaccination_chart",
          padding: { left: 20, right: 20, top: 10, bottom: 10 },
          data: {
            json: {
              date: elementData.date.slice(nonNullIndex),
              "1차 접종":
                elementData.vaccinated_first_total.slice(nonNullIndex),
              "2차 접종":
                elementData.vaccinated_second_total.slice(nonNullIndex),
            },
            x: "date",
            type: "area-spline",
            colors: {
              "1차 접종": "#29C7CA",
              "2차 접종": "#2CABB1",
            },
          },
          axis: {
            x: {
              show: true,
              type: "timeseries",
              tick: {
                format: "%y.%m.%d",
                fit: true,
                outer: false,
                count: axisXcount,
              },
            },
            y: {
              show: false,
              tick: {
                format: (d) => toLocalString(d) + " 명",
              },
            },
          },

          point: {
            show: false,
          },
        });
      }

      /**누적 확진 추이 차트*/
      c3.generate({
        bindto: "#total_confirmed_chart",
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
        data: {
          json: {
            date: elementData.date,
            확진: elementData.confirmed_total,
            격리해제: elementData.recovered_total,
          },
          x: "date",
          type: "area-spline",
          colors: {
            확진: "#353942",
            격리해제: "#29c7ca",
          },
        },
        axis: {
          x: {
            show: true,
            type: "timeseries",
            tick: {
              format: "%y.%m.%d",
              fit: true,
              outer: false,
              count: axisXcount,
            },
          },
          y: {
            padding: 0,
            show: false,
            tick: {
              format: (d) => toLocalString(d) + " 명",
            },
          },
        },
        point: {
          show: false,
        },
      });
      //신규 확진자 그래프
      c3.generate({
        bindto: "#new_confirmed_chart",
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
        data: {
          json: {
            date: elementData.date,
            "국내 감염": elementData.quarantine_new_domestic,
            "해외 감염": elementData.quarantine_new_overseas,
            전체: elementData.quarantine_new_total,
          },
          groups: [["국내 감염", "해외 감염"]],
          x: "date",
          types: {
            "국내 감염": "area-spline",
            "해외 감염": "area-spline",
            전체: "spline",
          },
        },
        legend: {
          hide: true,
        },
        axis: {
          x: {
            show: true,
            type: "timeseries",
            tick: {
              multiline: false,
              format: "%y.%m.%d",
              fit: true,
              outer: false,
              centered: true,
              count: axisXcount,
            },
          },
          y: {
            padding: 0,
            show: false,
            tick: {
              format: (d) => toLocalString(d) + " 명",
            },
          },
        },
        point: {
          show: false,
        },
      });
      const vaccined_confirmed_chart = c3.generate({
        bindto: "#vaccined_confirmed_chart",
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
        data: {
          json: {
            date: elementData.date,
            "2차 접종": elementData.vaccinated_second_total,
            "신규 확진": elementData.quarantine_new_total,
          },
          x: "date",
          type: "spline",
          axes: {
            "신규 확진": "y2",
          },
          colors: {
            "신규 확진": "#353942",
            "2차 접종": "#2CABB1",
          },
        },
        axis: {
          x: {
            show: true,
            type: "timeseries",
            tick: {
              format: "%y.%m.%d",
              fit: true,
              outer: false,
              centered: true,
              count: axisXcount,
            },
          },
          y: {
            padding: 0,
            show: false,
            tick: {
              outer: false,
              format: (d) => toLocalString(d) + " 명",
            },
          },
          y2: {
            padding: 0,
            show: false,
            tick: {
              outer: false,
              format: (d) => toLocalString(d) + " 명",
            },
          },
        },
        point: {
          show: false,
        },
      });
      c3.generate({
        bindto: "#new_dead_chart",
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
        data: {
          json: {
            date: elementData.date,
            사망: elementData.dead_new,
          },
          x: "date",
          type: "spline",
          colors: {
            사망: "#353942",
          },
        },
        legend: {
          hide: true,
        },
        axis: {
          x: {
            show: true,
            type: "timeseries",
            tick: {
              format: "%y.%m.%d",
              fit: true,
              outer: false,
              count: axisXcount,
            },
          },
          y: {
            padding: 0,
            show: false,
            tick: {
              format: (d) => toLocalString(d) + " 명",
            },
          },
        },

        point: {
          show: false,
        },
      });
    }
    document.getElementById("loading").style.display = "none";
    chartLoading.style.display = "none";
  });
}

/**날짜 형식 숫자로 변경
 * @param date 날짜 "2021-05-01"
 * @returns 20210501
 */
function convert_date(date) {
  date = new Date(date);
  const num2str = (num) => (num < 10 ? "0" + num : String(num)),
    year = String(date.getFullYear()), //yyyy
    month = num2str(1 + date.getMonth()), //M
    day = num2str(date.getDate());
  return Number(year + month + day);
}

/**Web worker에서 코로나 API 정보를 받아옴
 * @param query 필요한 정보를 요청할 Query
 * @param function 응답 받은 json 데이터를 활용하는 함수
 */
function covid19_API(query, funtion) {
  const APIworker = new Worker("./src/js/worker.js");
  APIworker.postMessage(query);
  APIworker.onmessage = (messageEvent) => {
    APIworker.terminate();
    funtion(messageEvent.data.regionalDataList);
  };
}

/**기준 날짜에서 원하는 일수를 뺀 날짜
 * @param date 기준 날짜
 * @param num 뺄 일수
 */
function minus_date(date, num) {
  date = new Date(date);
  date.setDate(date.getDate() - num);
  return date;
}
